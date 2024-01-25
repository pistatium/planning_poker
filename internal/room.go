package internal

import (
	"fmt"
	"strconv"
	"sync"
	"time"
)

type Room struct {
	id             string
	estimates      []*Estimate
	lastModifiedAt time.Time
	lastRevealedAt *time.Time
	mu             sync.RWMutex
}

func NewRoom(id string) *Room {
	return &Room{
		id:             id,
		estimates:      []*Estimate{},
		lastModifiedAt: time.Now(),
	}
}

func (r *Room) ID() string {
	return r.id
}

func (r *Room) Estimates() []*Estimate {
	r.mu.RLock()
	defer r.mu.RUnlock()
	return r.estimates
}

func (r *Room) LastModifiedAt() time.Time {
	return r.lastModifiedAt
}

func (r *Room) LastRevealedAt() *time.Time {
	return r.lastRevealedAt
}

var UserAlreadyExistsError = fmt.Errorf("user already exists")
var UserNotFoundError = fmt.Errorf("user not found")

func (r *Room) AddUser(userName string) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, est := range r.estimates {
		if est.User.Name == userName {
			est.User.LastUsedAt = time.Now()
			return UserAlreadyExistsError
		}
	}
	user := NewUser(userName)
	estimate := &Estimate{
		User:  user,
		Point: &PointNotSet,
	}
	r.estimates = append(r.estimates, estimate)
	r.lastModifiedAt = time.Now()
	return nil
}

func (r *Room) SetEstimate(userName string, point *Point) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, est := range r.estimates {
		if est.User.Name == userName {
			est.Point = point
			est.User.LastUsedAt = time.Now()
			r.lastModifiedAt = time.Now()
			return nil
		}
	}
	return UserNotFoundError
}

func (r *Room) RevealEstimates() {
	r.mu.Lock()
	defer r.mu.Unlock()
	now := time.Now()
	r.lastRevealedAt = &now
}

func (r *Room) ResetEstimates() {
	r.mu.Lock()
	defer r.mu.Unlock()
	for _, est := range r.estimates {
		est.Point = &PointNotSet
	}
	r.lastModifiedAt = time.Now()
}

type User struct {
	Name       string
	LastUsedAt time.Time
}

func NewUser(name string) *User {
	return &User{Name: name, LastUsedAt: time.Now()}
}

type Point struct {
	isCountable bool
	value       int
	label       string
}

var PointNotSet = Point{}
var PointUnknown = Point{isCountable: false, value: 0, label: "?"}
var PointInfinite = Point{isCountable: false, value: 0, label: "∞"}

func NewPoint(label string) (*Point, error) {
	switch label {
	case "?":
		return &PointUnknown, nil
	case "∞":
		return &PointInfinite, nil
	case "":
		return &PointNotSet, nil
	default:
	}
	i, err := strconv.Atoi(label)
	if err != nil {
		return nil, fmt.Errorf("invalid point: %s", label)
	}
	return &Point{isCountable: true, value: i, label: label}, nil
}

func (p *Point) Label() string {
	return p.label
}

type Estimate struct {
	User  *User
	Point *Point
}
