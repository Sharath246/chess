package main

import "testing"

func TestValidUsername(t *testing.T) {
	tests := []struct {
		name  string
		input string
		want  bool
	}{
		{name: "normal username", input: "sharath", want: true},
		{name: "less than 3 chars", input: "av", want: false},
		{name: "more than 20 chars", input: "abcdefghijklmnopqrstu", want: false},
		{name: "3 chars username", input: "abc", want: true},
		{name: "20 chars username", input: "abcdefghijklmnopqrst", want: true},
		{name: "alphanumeric", input: "sharath2345", want: true},
		{name: "non alphanumeric", input: "sharath#chandra", want: false},
		{name: "Uppercase char", input: "Sharath", want: false},
		{name: "empty string", input: "", want: false},
		{name: "space input", input: "sharath chandra", want: false},
		{name: "username with underscore", input: "sharath_chandra", want: true},
		{name: "username with hyphen", input: "sharath-chandra", want: false},
		{name: "non ascii value in username", input: "ే్పే", want: false},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if got := validUsername(tc.input); got != tc.want {
				t.Errorf("validUsername(%q); got = %t; want = %t", tc.input, got, tc.want)
			}
		})
	}
}
