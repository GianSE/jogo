// Package domain holds the core entities and repository interfaces. It must not
// import any framework or infrastructure package — dependencies point inward.
package domain

import "time"

// Scene identifies where a player/gift currently is.
type Scene string

const (
	SceneIsland Scene = "island"
	SceneHouse  Scene = "house"
)

// ItemCategory groups catalog items.
type ItemCategory string

const (
	CategoryGift      ItemCategory = "gift"
	CategoryFurniture ItemCategory = "furniture"
	CategoryResource  ItemCategory = "resource"
)

// MemoryKind enumerates auto-generated milestones. "first_*" kinds fire once
// per world (enforced by a partial unique index).
type MemoryKind string

const (
	MemoryFirstLoginTogether MemoryKind = "first_login_together"
	MemoryFirstGift          MemoryKind = "first_gift"
	MemoryFirstHouseEntry    MemoryKind = "first_house_entry"
	MemoryFirstResource      MemoryKind = "first_resource"
)

type User struct {
	ID           string
	Email        string
	Handle       string
	PasswordHash string
	CreatedAt    time.Time
	UpdatedAt    time.Time
}

type World struct {
	ID         string
	Name       string
	InviteCode string
	CreatedBy  string
	CreatedAt  time.Time
	UpdatedAt  time.Time
}

type WorldPlayer struct {
	ID       string
	WorldID  string
	UserID   string
	Slot     int16
	JoinedAt time.Time
}

type PlayerState struct {
	ID         string
	WorldID    string
	UserID     string
	Scene      Scene
	X          int
	Y          int
	Facing     int16
	Online     bool
	LastSeenAt time.Time
	UpdatedAt  time.Time
}

type Item struct {
	ID        string
	Slug      string
	Name      string
	Category  ItemCategory
	AssetKey  string
	CreatedAt time.Time
}

type InventoryEntry struct {
	ID        string
	WorldID   string
	UserID    string
	ItemID    string
	Quantity  int
	UpdatedAt time.Time
}

type Message struct {
	ID        int64
	WorldID   string
	SenderID  string
	Body      string
	CreatedAt time.Time
}

type Gift struct {
	ID         string
	WorldID    string
	ItemID     string
	FromUserID string
	ToUserID   *string
	Scene      Scene
	X          int
	Y          int
	Message    *string
	PickedUp   bool
	PickedUpBy *string
	CreatedAt  time.Time
	PickedUpAt *time.Time
}

type House struct {
	ID        string
	WorldID   string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Furniture struct {
	ID        string
	HouseID   string
	ItemID    string
	X         int
	Y         int
	Rotation  int16
	ZIndex    int
	PlacedBy  *string
	CreatedAt time.Time
	UpdatedAt time.Time
}

type Memory struct {
	ID          string
	WorldID     string
	Kind        MemoryKind
	Description string
	OccurredAt  time.Time
	CreatedAt   time.Time
}
