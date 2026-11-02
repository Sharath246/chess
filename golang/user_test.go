package main

import "testing"

func TestValidUsername(t *testing.T) {
	tests := []struct {
		name    string
		input   string
		isValid bool
	}{
		{name: "normal username", input: "sharath", isValid: true},
		{name: "less than 3 chars", input: "av", isValid: false},
		{name: "more than 20 chars", input: "abcdefghijklmnopqrstu", isValid: false},
		{name: "alphanumeric", input: "sharath#2345", isValid: false},
		{name: "empty string", input: "", isValid: false},
		{name: "space input", input: "sharath chandra", isValid: false},
		{name: "username with underscore", input: "sharath_chandra", isValid: true},
		{name: "username with hyphen", input: "sharath-chandra", isValid: false},
		{name: "non ascii value in username", input: "ే్పే", isValid: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := validUsername(tc.input); got != tc.isValid {
				t.Errorf("validUsername(%s); got = %t; want = %t", tc.input, got, tc.isValid)
			}
		})
	}
}
