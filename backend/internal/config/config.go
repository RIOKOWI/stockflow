package config

import (
	"bufio"
	"fmt"
	"net/url"
	"os"
	"strings"
)

type Config struct {
	AppPort        string
	DBHost         string
	DBPort         string
	DBUser         string
	DBPassword     string
	DBName         string
	DBSSLMode      string
	FrontendOrigin string
}

func Load() (*Config, error) {
	loadDotEnv(".env")

	c := &Config{
		AppPort:        getenv("APP_PORT", "8080"),
		DBHost:         getenv("DB_HOST", "localhost"),
		DBPort:         getenv("DB_PORT", "5432"),
		DBUser:         getenv("DB_USER", "stockflow"),
		DBPassword:     getenv("DB_PASSWORD", "stockflow_dev_password"),
		DBName:         getenv("DB_NAME", "stockflow"),
		DBSSLMode:      getenv("DB_SSLMODE", "disable"),
		FrontendOrigin: getenv("FRONTEND_ORIGIN", "http://localhost:5175"),
	}

	if err := c.validate(); err != nil {
		return nil, err
	}
	return c, nil
}

func (c *Config) validate() error {
	missing := []string{}
	for name, value := range map[string]string{
		"APP_PORT":        c.AppPort,
		"DB_HOST":         c.DBHost,
		"DB_PORT":         c.DBPort,
		"DB_USER":         c.DBUser,
		"DB_PASSWORD":     c.DBPassword,
		"DB_NAME":         c.DBName,
		"DB_SSLMODE":      c.DBSSLMode,
		"FRONTEND_ORIGIN": c.FrontendOrigin,
	} {
		if strings.TrimSpace(value) == "" {
			missing = append(missing, name)
		}
	}
	if len(missing) > 0 {
		return fmt.Errorf("config: missing required values: %s", strings.Join(missing, ", "))
	}
	return nil
}

// DSN returns the PostgreSQL connection URL built from the DB_* values.
func (c *Config) DSN() string {
	u := url.URL{
		Scheme:   "postgres",
		User:     url.UserPassword(c.DBUser, c.DBPassword),
		Host:     fmt.Sprintf("%s:%s", c.DBHost, c.DBPort),
		Path:     "/" + c.DBName,
		RawQuery: "sslmode=" + c.DBSSLMode,
	}
	return u.String()
}

// DatabaseURL returns DATABASE_URL when set, otherwise the DSN from DB_*.
func (c *Config) DatabaseURL() string {
	if v := strings.TrimSpace(os.Getenv("DATABASE_URL")); v != "" {
		return v
	}
	return c.DSN()
}

func getenv(key, fallback string) string {
	if v := strings.TrimSpace(os.Getenv(key)); v != "" {
		return v
	}
	return fallback
}

// loadDotEnv fills unset environment variables from a .env file. Existing
// environment variables always win.
func loadDotEnv(path string) {
	file, err := os.Open(path)
	if err != nil {
		return
	}
	defer file.Close()

	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}
		key, value, ok := strings.Cut(line, "=")
		if !ok {
			continue
		}
		key = strings.TrimSpace(key)
		value = strings.Trim(strings.TrimSpace(value), `"'`)
		if key == "" || os.Getenv(key) != "" {
			continue
		}
		os.Setenv(key, value)
	}
}
