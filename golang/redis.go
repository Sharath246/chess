package main

import (
	"context"
	"time"

	"github.com/redis/go-redis/v9"
)

var rdb *redis.Client
var ctx = context.Background()

func set_redis_key(key string, value string, expiration time.Duration) error {
	err := rdb.Set(ctx, key, string(value), expiration).Err()

	if err != nil {
		return err
	}

	return nil
}

func delete_redis_key(key string) error {
	err := rdb.Del(ctx, key).Err()

	if err != nil {
		return err
	}
	return nil
}

func get_redis_key(key string) (string, error) {
	val, err := rdb.Get(ctx, key).Result()

	if err != nil {
		return "", err
	}

	return val, nil
}

func redis_main() {

	rdb = redis.NewClient(&redis.Options{
		Addr:     "localhost:6379",
		Password: "", // No password set
		DB:       0,  // Default DB
	})

}
