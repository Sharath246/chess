package main

import (
	"slices"
	"testing"
)

func TestStateMachine(t *testing.T) {
	const ABCD MESSAGE_TYPE = "ABCD"
	tests := []struct {
		name         string
		input        MESSAGE_TYPE
		prior_states []MESSAGE_TYPE
	}{
		{name: "online prior states", input: ONLINE, prior_states: []MESSAGE_TYPE{"", ONLINE, PLAYING_GAME}},
		{name: "ready for game prior states", input: READY_FOR_GAME, prior_states: []MESSAGE_TYPE{ONLINE, REQUEST_GAME, PAIRED}},
		{name: "request game prior states", input: REQUEST_GAME, prior_states: []MESSAGE_TYPE{READY_FOR_GAME}},
		{name: "paired prior states", input: PAIRED, prior_states: []MESSAGE_TYPE{READY_FOR_GAME, REQUEST_GAME}},
		{name: "playing game prior states", input: PLAYING_GAME, prior_states: []MESSAGE_TYPE{PAIRED}},
		{name: "blank input prior states", input: "", prior_states: []MESSAGE_TYPE{}},
		{name: "blank input prior states", input: ABCD, prior_states: []MESSAGE_TYPE{}},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			got := state_machine(tc.input)
			got_diff_want := ""
			for i := 0; i < len(got); i++ {
				if !slices.Contains(tc.prior_states, got[i]) {
					got_diff_want += "'" + string(got[i]) + "'"
				}
			}

			want_diff_got := ""
			for i := 0; i < len(tc.prior_states); i++ {
				if !slices.Contains(got, tc.prior_states[i]) {
					want_diff_got = "'" + string(tc.prior_states[i]) + "'"
				}
			}

			if got_diff_want != "" || want_diff_got != "" {
				t.Errorf("not present in got = %s, not present in want = %s", want_diff_got, got_diff_want)
			}
		})
	}
}
