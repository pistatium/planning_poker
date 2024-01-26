package internal

import (
	"context"
	firebase "firebase.google.com/go"
	"fmt"
	"github.com/pistatium/planing_poker/internal/entities"
	"log/slog"
	"sync"
	"time"
)

type FirestoreProjectID string
type FirestoreCollectionName string
type FirestoreRoomRepository struct {
	projectID      FirestoreProjectID
	collectionName FirestoreCollectionName
	app            *firebase.App
}

func NewFirestoreRoomRepository(ctx context.Context, projectID FirestoreProjectID, collectionName FirestoreCollectionName) (*FirestoreRoomRepository, error) {
	conf := firebase.Config{ProjectID: string(projectID)}
	app, err := firebase.NewApp(ctx, &conf)
	if err != nil {
		slog.Error("firebase.NewApp error:", slog.Any("error", err))
		return nil, err
	}
	return &FirestoreRoomRepository{projectID: projectID, collectionName: collectionName, app: app}, nil
}

var rooms = map[string]*entities.Room{}
var _ RoomRepository = (*FirestoreRoomRepository)(nil)

var mu = sync.RWMutex{}

/*
	とりあえず１インスタンスで動かす想定で実装
	読み込み:
		メモリ上にRoomがあればメモリを、
		なければFirestoreから取得してメモリにのせる(インスタンス生え替わっても引き継げる)
	書き込み:
		メモリとFirestore両方に書き込む
*/

type RoomWithExpiresAt struct {
	*entities.SerializedRoom
	ExpiresAt time.Time `json:"expires_at"`
}

func (f2 FirestoreRoomRepository) Transaction(ctx context.Context, f func(ctx context.Context) (*entities.Room, error)) (*entities.Room, error) {
	return f(ctx)
}

func (f2 FirestoreRoomRepository) Find(ctx context.Context, roomID string) (*entities.Room, error) {
	mu.RLock()
	defer mu.RUnlock()
	if room, ok := rooms[roomID]; ok {
		return room, nil
	}
	client, err := f2.app.Firestore(ctx)
	if err != nil {
		return nil, fmt.Errorf("fail to init firestore: %v", err)
	}
	defer client.Close()
	doc, err := client.Collection(string(f2.collectionName)).Doc(roomID).Get(ctx)
	if err != nil {
		if doc != nil && !doc.Exists() {
			// ローカルに新規作成
			newRoom := entities.NewRoom(roomID)
			rooms[roomID] = newRoom
			return newRoom, nil
		} else {
			return nil, fmt.Errorf("fail to get room: %v", err)
		}
	}
	var serialized entities.SerializedRoom
	if err := doc.DataTo(&serialized); err != nil {
		return nil, fmt.Errorf("fail to deserialize room: %v", err)
	}
	room, err := entities.NewFromSerializedRoom(serialized)
	if err != nil {
		return nil, fmt.Errorf("fail to deserialize room: %v", err)
	}
	rooms[roomID] = room
	return room, nil
}

func (f2 FirestoreRoomRepository) Save(ctx context.Context, room *entities.Room) error {
	mu.Lock()
	defer mu.Unlock()
	client, err := f2.app.Firestore(ctx)
	if err != nil {
		return fmt.Errorf("fail to init firestore: %v", err)
	}
	defer client.Close()
	serialized := room.Serialize()
	serializedWithExpiresAt := RoomWithExpiresAt{
		SerializedRoom: &serialized,
		ExpiresAt:      time.Now().Add(24 * time.Hour),
	}
	_, err = client.Collection(string(f2.collectionName)).Doc(room.ID()).Set(ctx, serializedWithExpiresAt)
	if err != nil {
		return fmt.Errorf("fail to save room: %v", err)
	}
	rooms[room.ID()] = room
	slog.Info("room saved",
		slog.String("room_id", room.ID()),
		slog.Any("last_modified", room.LastModifiedAt()),
	)
	return nil
}
