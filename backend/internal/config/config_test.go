package config

import (
	"os"
	"path/filepath"
	"testing"
)

func TestDSN(t *testing.T) {
	c := &Config{
		DBHost:     "localhost",
		DBPort:     "5432",
		DBUser:     "stockflow",
		DBPassword: "pw",
		DBName:     "stockflow",
		DBSSLMode:  "disable",
	}
	want := "postgres://stockflow:pw@localhost:5432/stockflow?sslmode=disable"
	if got := c.DSN(); got != want {
		t.Fatalf("DSN() = %q, want %q", got, want)
	}
}

func TestLoadDotEnvKeepsExistingEnv(t *testing.T) {
	path := filepath.Join(t.TempDir(), ".env")
	content := "DB_NAME=from_file\n# comment\n\nDB_USER='quoted'\n"
	if err := os.WriteFile(path, []byte(content), 0o600); err != nil {
		t.Fatal(err)
	}

	t.Setenv("DB_NAME", "from_env")
	loadDotEnv(path)

	if got := os.Getenv("DB_NAME"); got != "from_env" {
		t.Fatalf("DB_NAME = %q, want the pre-existing environment value", got)
	}
	if got := os.Getenv("DB_USER"); got != "quoted" {
		t.Fatalf("DB_USER = %q, want %q", got, "quoted")
	}
}

func TestValidateRequiresValues(t *testing.T) {
	c := &Config{DBHost: "localhost", DBPort: "5432", DBUser: "stockflow", DBName: "stockflow"}
	if err := c.validate(); err == nil {
		t.Fatal("validate() = nil, want an error for missing values")
	}
}
