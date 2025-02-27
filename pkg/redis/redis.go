package redis

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

// Initializes a connection to Redis.
func InitRedis() {
	redisURL := os.Getenv("REDIS_URL")
	// parse the URL into an options struct
	opt, err := redis.ParseURL(redisURL)
	if err != nil {
		log.Fatalf("(InitRedis) Failed to parse Redis URL: %v", err)
	}

	RDB := redis.NewClient(opt)

	_, err = RDB.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("(InitRedis) Unable to connect to Redis: %v", err)
	}

	log.Println("(InitRedis) Connected to Redis")
}
