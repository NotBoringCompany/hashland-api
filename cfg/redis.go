package cfg

import (
	"context"
	"log"
	"os"

	"github.com/redis/go-redis/v9"
)

var RDB *redis.Client

// Initializes a connection to Redis.
func InitRedis() {
	RDB = redis.NewClient(&redis.Options{
		Addr:     os.Getenv("REDIS_URL"),
		Password: "",
		DB:       0,
	})

	_, err := RDB.Ping(context.Background()).Result()
	if err != nil {
		log.Fatalf("(InitRedis) Unable to connect to Redis: %v", err)
	}
	log.Println("(InitRedis) Connected to Redis")
}
