package internal

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

type EventManager struct {
	roomRepository RoomRepository
}

func NewEventManager(roomRepository RoomRepository) *EventManager {
	return &EventManager{roomRepository: roomRepository}
}

func (e *EventManager) RoomChangedStream(ctx context.Context, roomID string) <-chan *Room {
	ch := make(chan *Room)
	go func() {
		defer close(ch)
		lastUpdatedAt := time.Now()
		for {
			time.Sleep(1000 * time.Millisecond)
			room, err := e.Get(ctx, roomID)
			if err != nil {
				slog.Error("get error:", slog.Any("error", err))
				return
			}
			if room == nil {
				slog.Info("room not found")
				continue
			}
			if room.lastModifiedAt.After(lastUpdatedAt) {
				slog.Info("room changed", slog.Any("room", room))
				ch <- room
				lastUpdatedAt = room.lastModifiedAt
			}
		}
	}()
	return ch
}

func (e *EventManager) Get(ctx context.Context, roomID string) (*Room, error) {
	// Roomの現在の状態をを取得
	return e.roomRepository.Find(ctx, roomID)
}

func (e *EventManager) Join(ctx context.Context, roomID string, userName string) (*Room, error) {
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		// Roomが存在しない場合は新規作成
		if room == nil {
			room = NewRoom(roomID)
		}
		err = room.AddUser(userName)
		if err != nil && !errors.Is(err, UserAlreadyExistsError) {
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

func (e *EventManager) SetEstimate(ctx context.Context, roomID string, userName string, point *Point) (*Room, error) {
	// 見積もりをセット
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*Room, error) {
		room, err := e.roomRepository.Find(ctx, roomID)
		if err != nil {
			return nil, err
		}
		if room == nil {
			return nil, fmt.Errorf("room %s not found", roomID)
		}
		if room.lastRevealedAt != nil && room.lastRevealedAt.After(room.lastModifiedAt) {
			slog.Info("!!!!reset estimates")
			room.ResetEstimates()
		}
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

func (e *EventManager) RevealEstimates(ctx context.Context, roomID string) (*Room, error) {
	// 見積もりを公開
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*Room, error) {
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

func (e *EventManager) Reset(ctx context.Context, roomID string) (*Room, error) {
	// 見積もりをリセット
	return e.roomRepository.Transaction(ctx, func(ctx context.Context) (*Room, error) {
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
