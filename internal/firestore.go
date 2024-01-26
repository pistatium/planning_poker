package internal

import (
	"cloud.google.com/go/firestore"
	"context"
	"fmt"
	"github.com/pistatium/planing_poker/internal/entities"
	"log/slog"
	"sync"
	"time"
)

type FirestoreProjectID string

// FirestoreDatabaseName default以外のデータベースを使う場合指定
type FirestoreDatabaseName string
type FirestoreCollectionName string
type FirestoreRoomRepository struct {
	projectID      FirestoreProjectID
	collectionName FirestoreCollectionName
	databaseName   FirestoreDatabaseName
}

func NewFirestoreRoomRepository(projectID FirestoreProjectID, collectionName FirestoreCollectionName, databaseName FirestoreDatabaseName) *FirestoreRoomRepository {
	return &FirestoreRoomRepository{projectID: projectID, collectionName: collectionName, databaseName: databaseName}
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
	var client *firestore.Client
	var err error
	if f2.databaseName == "" {
		client, err = firestore.NewClient(ctx, string(f2.projectID))
	} else {
		client, err = firestore.NewClientWithDatabase(ctx, string(f2.projectID), string(f2.databaseName))
	}
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
	var client *firestore.Client
	var err error
	if f2.databaseName == "" {
		client, err = firestore.NewClient(ctx, string(f2.projectID))
	} else {
		client, err = firestore.NewClientWithDatabase(ctx, string(f2.projectID), string(f2.databaseName))
	}
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
