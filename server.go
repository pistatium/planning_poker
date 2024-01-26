package main

import (
	"context"
	"encoding/json"
	"github.com/gorilla/websocket"
	"github.com/kelseyhightower/envconfig"
	"github.com/pistatium/planing_poker/internal"
	"github.com/pistatium/planing_poker/internal/entities"
	"log"
	"log/slog"
	"net"
	"net/http"
	"os"
	"strconv"
	"time"
)

type Env struct {
	Port      int `envconfig:"PORT" default:"8080"`
	Firestore struct {
		ProjectID      internal.FirestoreProjectID      `envconfig:"FIRESTORE_PROJECT_ID" required:"true"`
		DatabaseName   internal.FirestoreDatabaseName   `envconfig:"FIRESTORE_DATABASE_NAME" default:""`
		CollectionName internal.FirestoreCollectionName `envconfig:"FIRESTORE_ROOM_COLLECTION_NAME" default:"planing_poker_rooms"`
	}
}

var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
}

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	var env Env
	err := envconfig.Process("", &env)
	if err != nil {
		log.Fatalf("Failed to parse environment variables: %v", err)
	}
	roomRepository := internal.NewFirestoreRoomRepository(env.Firestore.ProjectID, env.Firestore.CollectionName, env.Firestore.DatabaseName)
	server := &Server{
		eventManager: internal.NewEventManager(roomRepository),
	}

	http.HandleFunc("/ws", server.wsHandler)
	// ファイルをホストする
	http.Handle("/", http.StripPrefix("/", http.FileServer(http.Dir("public"))))
	slog.Info("server started", slog.Any("port", env.Port))
	log.Fatal(http.ListenAndServe(net.JoinHostPort("", strconv.Itoa(env.Port)), nil))
}

type Message struct {
	Type       string `json:"type"`
	UserName   string `json:"user_name"`
	PointLabel string `json:"point"`
}

type Server struct {
	eventManager *internal.EventManager
}

type RepsEstimate struct {
	UserName   string `json:"user_name"`
	PointLabel string `json:"point"`
}

type Response struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

type EstimatesResponse struct {
	Response
	Estimates   []RepsEstimate `json:"estimates"`
	EstimatedAt time.Time      `json:"estimated_at"`
}

type RespParticipant struct {
	UserName    string `json:"user_name"`
	IsEstimated bool   `json:"is_estimated"`
}
type ParticipantResponse struct {
	Response
	Participants []RespParticipant `json:"participants"`
	State        entities.State    `json:"state"`
}

func (s *Server) wsHandler(w http.ResponseWriter, r *http.Request) {

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		slog.Error("upgrade error:", slog.Any("error", err))
		return
	}
	defer conn.Close()

	// parameterからroomIDを取得
	roomID := r.URL.Query().Get("room")
	if roomID == "" {
		slog.Error("roomID is empty")
		return
	}
	slog.Info("roomID", slog.String("roomID", roomID))

	// ソケットメッセージのストリームを生成
	messageStream := make(chan []byte)
	var userName string
	go func() {
		defer close(messageStream)
		for {
			_, message, err := conn.ReadMessage()
			slog.Info("connected", slog.String("remote_addr", conn.RemoteAddr().String()))
			// コネクション切断など
			if err != nil {
				if userName != "" {
					_, leaveErr := s.eventManager.Leave(r.Context(), roomID, userName)
					if leaveErr != nil {
						slog.Error("leave error:", slog.Any("error", err))
					}
				}
				slog.Error("read error:",
					slog.Any("error", err),
					slog.String("remote_addr", conn.RemoteAddr().String()),
				)
				break
			}
			messageStream <- message
		}
	}()
	// ルームの変更を監視するストリームを生成
	roomEventStream := s.eventManager.RoomChangedStream(r.Context(), roomID)
	now := time.Now()
	lastRevealed := &now
	if err != nil {
		slog.Error("listen error:", slog.Any("error", err))
		return
	}
	for {
		slog.Info("waiting message")
		select {
		case <-r.Context().Done():
			return
		case message, ok := <-messageStream:
			if !ok {
				return
			}
			userName = s.handleWsMessage(r.Context(), conn, roomID, message)
		case room, ok := <-roomEventStream:
			if !ok {
				return
			}
			sendParticipants(conn, room)
			if lastRevealed != room.LastRevealedAt() && room.State() == entities.StateEstimated {
				sendEstimates(conn, room)
				lastRevealed = room.LastRevealedAt()
			}
		}

	}
}

func (s *Server) handleWsMessage(ctx context.Context, conn *websocket.Conn, roomID string, message []byte) (userName string) {
	var m Message
	err := json.Unmarshal(message, &m)
	if err != nil {
		slog.Error("unmarshal error:",
			slog.Any("error", err),
			slog.String("remote_addr", conn.RemoteAddr().String()),
			slog.String("message", string(message)),
		)
		sendError(conn, err)
		return
	}
	slog.Info("message", slog.String("message", string(message)))
	switch m.Type {
	case "get":
		{
			room, err := s.eventManager.Get(ctx, roomID)
			if err != nil {
				sendError(conn, err)
				return
			}
			sendParticipants(conn, room)
		}

	case "join":
		{
			room, err := s.eventManager.Join(ctx, roomID, m.UserName)
			if err != nil {
				sendError(conn, err)
			}
			sendJoinStatus(conn)
			sendParticipants(conn, room)
		}
	case "estimate":
		{
			point, err := entities.NewPoint(m.PointLabel)
			if err != nil {
				sendError(conn, err)
				return
			}
			room, err := s.eventManager.SetEstimate(ctx, roomID, m.UserName, point)
			if err != nil {
				sendError(conn, err)
				return
			}
			sendParticipants(conn, room)
		}
	case "reset":
		{
			room, err := s.eventManager.Reset(ctx, roomID)
			if err != nil {
				sendError(conn, err)
				return
			}
			sendParticipants(conn, room)

		}
	case "reveal":
		{
			room, err := s.eventManager.RevealEstimates(ctx, roomID)
			if err != nil {
				sendError(conn, err)
				return
			}
			sendEstimates(conn, room)
		}
	}
	return m.UserName
}

func sendError(conn *websocket.Conn, err error) {
	slog.Error("write error:", slog.Any("error", err))
	err = conn.WriteJSON(&Response{
		Type:    "error",
		Message: err.Error(),
	})
	if err != nil {
		slog.Error("write error:", slog.Any("error", err))
	}
}

func sendEstimates(conn *websocket.Conn, room *entities.Room) {
	var estimates []RepsEstimate
	for _, e := range room.Estimates() {
		estimates = append(estimates, RepsEstimate{
			UserName:   e.User.Name,
			PointLabel: e.Point.Label(),
		})
	}
	err := conn.WriteJSON(&EstimatesResponse{
		Response: Response{
			Type: "estimates",
		},
		Estimates:   estimates,
		EstimatedAt: *room.LastRevealedAt(),
	})
	if err != nil {
		sendError(conn, err)
	}
}

func sendParticipants(conn *websocket.Conn, room *entities.Room) {
	var participants []RespParticipant
	for _, e := range room.Estimates() {
		participants = append(participants, RespParticipant{
			UserName:    e.User.Name,
			IsEstimated: e.Point != &entities.PointNotSet,
		})
	}
	err := conn.WriteJSON(&ParticipantResponse{
		Response: Response{
			Type: "participants",
		},
		Participants: participants,
		State:        room.State(),
	})
	if err != nil {
		sendError(conn, err)
	}
}

func sendJoinStatus(conn *websocket.Conn) {
	err := conn.WriteJSON(&ParticipantResponse{
		Response: Response{
			Type: "joined",
		},
	})
	if err != nil {
		sendError(conn, err)
	}
}
