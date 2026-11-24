package main

import (
	"database/sql"
	"fmt"
	"os"

	"github.com/RIOKOWI/stockflow/internal/config"
	"github.com/RIOKOWI/stockflow/migrations"
	_ "github.com/jackc/pgx/v5/stdlib"
	"github.com/pressly/goose/v3"
)

func main() {
	if err := run(); err != nil {
		fmt.Fprintln(os.Stderr, "error:", err)
		os.Exit(1)
	}
}

func run() error {
	command := "up"
	if len(os.Args) > 1 {
		command = os.Args[1]
	}

	cfg, err := config.Load()
	if err != nil {
		return err
	}

	db, err := sql.Open("pgx", cfg.DSN())
	if err != nil {
		return err
	}
	defer db.Close()

	goose.SetBaseFS(migrations.FS)
	goose.SetDialect("postgres")

	switch command {
	case "up":
		return goose.Up(db, ".")
	case "down":
		return goose.Down(db, ".")
	case "reset":
		return goose.DownTo(db, ".", 0)
	case "status":
		return goose.Status(db, ".")
	case "version":
		return goose.Version(db, ".")
	default:
		return fmt.Errorf("unknown command %q (use up, down, reset, status or version)", command)
	}
}
