package main

import (
	"testing"
)

func TestCanTransition(t *testing.T) {
	tests := []struct {
		name string
		from MESSAGE_TYPE
		to   MESSAGE_TYPE
		want bool
	}{
		{name: "online to ready for game", from: ONLINE, to: READY_FOR_GAME, want: true},
		{name: "online to paired", from: ONLINE, to: PAIRED, want: false},
		{name: "online to playing game", from: ONLINE, to: PLAYING_GAME, want: false},
		{name: "ready for game to request game", from: READY_FOR_GAME, to: REQUEST_GAME, want: true},
		{name: "ready for game to paired", from: READY_FOR_GAME, to: PAIRED, want: true},
		{name: "ready for game to online", from: READY_FOR_GAME, to: ONLINE, want: false},
		{name: "request game to ready for game", from: REQUEST_GAME, to: READY_FOR_GAME, want: true},
		{name: "request game to paired", from: REQUEST_GAME, to: PAIRED, want: true},
		{name: "request game to request game", from: REQUEST_GAME, to: REQUEST_GAME, want: false},
		{name: "paired to ready for game", from: PAIRED, to: READY_FOR_GAME, want: true},
		{name: "paired to playing game", from: PAIRED, to: PLAYING_GAME, want: true},
		{name: "paired to online", from: PAIRED, to: ONLINE, want: false},
		{name: "playing game to online", from: PLAYING_GAME, to: ONLINE, want: true},
		{name: "playing game to ready for game", from: PLAYING_GAME, to: READY_FOR_GAME, want: false},
		{name: "playing game to playing game", from: PLAYING_GAME, to: PLAYING_GAME, want: true},
		{name: "empty current status to online", from: MESSAGE_TYPE(""), to: ONLINE, want: false},
		{name: "empty current status to ready for game", from: MESSAGE_TYPE(""), to: READY_FOR_GAME, want: false},
		{name: "unknown from to unknown", from: MESSAGE_TYPE("UNKNOWN"), to: MESSAGE_TYPE("UNKNOWN"), want: false},
		{name: "unknown request to online", from: MESSAGE_TYPE("UNKNOWN"), to: ONLINE, want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := canTransition(tc.from, tc.to)
			if got != tc.want {
				t.Fatalf("canTransition(%q, %q) = %v, want %v", tc.from, tc.to, got, tc.want)
			}
		})
	}
}
