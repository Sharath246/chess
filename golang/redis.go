package main

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client
var ctx = context.Background()

// set_redis_key takes a Redis key, value, and expiration duration, stores the value, and
// returns the Redis command error, if any.
func set_redis_key(key string, value string, expiration time.Duration) error {
	err := rdb.Set(ctx, key, string(value), expiration).Err()

	if err != nil {
		return err
	}

	return nil
}

// deleteRedisKey takes a Redis key, deletes it, and returns the Redis command error, if any.
func deleteRedisKey(key string) error {
	err := rdb.Del(ctx, key).Err()

	if err != nil {
		return err
	}
	return nil
}

// getRedisKey takes a Redis key and returns its stored string value and any lookup error.
func getRedisKey(key string) (string, error) {
	val, err := rdb.Get(ctx, key).Result()

	if err != nil {
		return "", err
	}

	return val, nil
}

// redis_main initializes the shared Redis client using the local server configuration. It
// takes no arguments and returns no value.
func redis_main() {

	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // No password set
		DB:       0,  // Default DB
	})

}
