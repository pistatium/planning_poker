package internal

import (
	"context"
	"errors"
	"fmt"
	"github.com/pistatium/planing_poker/internal/entities"
	"log/slog"
	"time"
)

type EventManager struct {
	roomRepository RoomRepository
}

func NewEventManager(roomRepository RoomRepository) *EventManager {
	return &EventManager{roomRepository: roomRepository}
}

func (e *EventManager) RoomChangedStream(ctx context.Context, roomID string) <-chan *entities.Room {
	ch := make(chan *entities.Room)
	go func() {
		defer close(ch)
		lastUpdatedAt := time.Now()
		for {
			time.Sleep(100 * time.Millisecond)
			room, err := e.Get(ctx, roomID)
			if err != nil {
				slog.Error("get error:", slog.Any("error", err))
				return
			}
			if room == nil {
				slog.Info("room not found")
				time.Sleep(10 * time.Second)
				continue
			}
			if room.LastModifiedAt().After(lastUpdatedAt) {
				slog.Info("room changed", slog.Any("room", room.Serialize()))
				ch <- room
				lastUpdatedAt = room.LastModifiedAt()
			}
		}
	}()
	return ch
}

func (e *EventManager) Get(ctx context.Context, roomID string) (*entities.Room, error) {
	// Roomの現在の状態をを取得
	return e.roomRepository.Find(ctx, roomID)
}

func (e *EventManager) Join(ctx context.Context, roomID string, userName string) (*entities.Room, error) {
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*entities.Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		// Roomが存在しない場合は新規作成
		if room == nil {
			room = entities.NewRoom(roomID)
		}
		err = room.AddUser(userName)
		if err != nil && !errors.Is(err, entities.UserAlreadyExistsError) {
			return nil, err
		}
		err = e.roomRepository.Save(ctx, room)
		if err != nil {
			return nil, err
		}
		// Roomに参加者登録
		return room, nil
	})
}

func (e *EventManager) Leave(ctx context.Context, roomID string, userName string) (*entities.Room, error) {
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*entities.Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if room == nil {
			return nil, fmt.Errorf("room %s not found", roomID)
		}
		err = room.RemoveUser(userName)
		if err != nil {
			return nil, err
		}
		err = e.roomRepository.Save(ctx, room)
		if err != nil {
			return nil, err
		}
		return nil, nil
	})
}
func (e *EventManager) SetEstimate(ctx context.Context, roomID string, userName string, point *entities.Point) (*entities.Room, error) {
	// 見積もりをセット
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*entities.Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if room == nil {
			return nil, fmt.Errorf("room %s not found", roomID)
		}
		//if room.LastRevealedAt() != nil && !room.LastRevealedAt().Before(room.LastModifiedAt()) {
		//	slog.Info("reset estimates")
		//	room.ResetEstimates()
		//}
		err = room.SetEstimate(userName, point)

		if err != nil {
			return nil, err
		}
		err = e.roomRepository.Save(ctx, room)
		if err != nil {
			return nil, err
		}
		// Roomに参加者登録
		return room, nil
	})
}

func (e *EventManager) RevealEstimates(ctx context.Context, roomID string) (*entities.Room, error) {
	// 見積もりを公開
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*entities.Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if room == nil {
			return nil, fmt.Errorf("room %s not found", roomID)
		}
		room.RevealEstimates()
		err = e.roomRepository.Save(ctx, room)
		if err != nil {
			return nil, err
		}
		return room, nil
	})
}

func (e *EventManager) Reset(ctx context.Context, roomID string) (*entities.Room, error) {
	// 見積もりをリセット
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*entities.Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if room == nil {
			return nil, fmt.Errorf("room %s not found", roomID)
		}
		room.ResetEstimates()
		err = e.roomRepository.Save(ctx, room)
		if err != nil {
			return nil, err
		}
		return room, nil
	})
}
