package main

import (
	"slices"
	"testing"
)

func TestStateMachine(t *testing.T) {
	tests := []struct {
		name  string
		input MESSAGE_TYPE
		want  []MESSAGE_TYPE
	}{
		{name: "online prior states", input: ONLINE, want: []MESSAGE_TYPE{"", ONLINE, PLAYING_GAME}},
		{name: "ready for game prior states", input: READY_FOR_GAME, want: []MESSAGE_TYPE{ONLINE, REQUEST_GAME, PAIRED}},
		{name: "request game prior states", input: REQUEST_GAME, want: []MESSAGE_TYPE{READY_FOR_GAME}},
		{name: "paired prior states", input: PAIRED, want: []MESSAGE_TYPE{READY_FOR_GAME, REQUEST_GAME}},
		{name: "playing game prior states", input: PLAYING_GAME, want: []MESSAGE_TYPE{PAIRED}},
		{name: "blank input prior states", input: "", want: []MESSAGE_TYPE{}},
		{name: "unknonwn state", input: MESSAGE_TYPE("UNKNOWN"), want: []MESSAGE_TYPE{}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := state_machine(tc.input)
			if !slices.Equal(got, tc.want) {
				t.Errorf("state_machine(%q) = %q, want %q", tc.input, got, tc.want)
			}
		})
	}
}
