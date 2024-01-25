package internal

import "context"

type RoomRepository interface {
	Transaction(ctx context.Context, f func(ctx context.Context) (*Room, error)) (*Room, error)
	Find(ctx context.Context, roomID string) (*Room, error)
	Save(ctx context.Context, room *Room) error
}
