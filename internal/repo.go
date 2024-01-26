package internal

import (
	"context"
	"github.com/pistatium/planing_poker/internal/entities"
)

type RoomRepository interface {
	Transaction(ctx context.Context, f func(ctx context.Context) (*entities.Room, error)) (*entities.Room, error)
	Find(ctx context.Context, roomID string) (*entities.Room, error)
	Save(ctx context.Context, room *entities.Room) error
}
