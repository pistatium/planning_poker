package internal

import (
	"context"
	"log/slog"
	"sync"
)

type FirestoreRoomRepository struct {
}

var rooms = map[string]*Room{}
var _ RoomRepository = (*FirestoreRoomRepository)(nil)

var mu = sync.RWMutex{}

func (f2 FirestoreRoomRepository) Transaction(ctx context.Context, f func(ctx context.Context) (*Room, error)) (*Room, error) {
	return f(ctx)
}

func (f2 FirestoreRoomRepository) Find(ctx context.Context, roomID string) (*Room, error) {
	mu.RLock()
	defer mu.RUnlock()
	return rooms[roomID], nil
}

func (f2 FirestoreRoomRepository) Save(ctx context.Context, room *Room) error {
	mu.Lock()
	defer mu.Unlock()
	rooms[room.id] = room
	slog.Info("room saved",
		slog.String("room_id", room.id),
		slog.Any("last_modified", room.lastModifiedAt),
	)
	return nil
}
