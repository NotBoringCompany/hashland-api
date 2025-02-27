package db

import (
	"context"
	"log"
	"os"

	"github.com/jackc/pgx/v5/pgxpool"
)

var DB *pgxpool.Pool

// Initializes a connection to the Postgres database.
func InitDB() {
	connStr := os.Getenv("DATABASE_URL")
	var err error
	DB, err = pgxpool.New(context.Background(), connStr)
	if err != nil {
		log.Fatalf("(InitDB) Unable to connect to Postgres: %v", err)
	}

	log.Println("(InitDB) Connected to Postgres")
}
