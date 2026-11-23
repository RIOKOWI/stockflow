package handler

import (
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"

	"github.com/RIOKOWI/stockflow/internal/service"
)

func writeJSON(w http.ResponseWriter, status int, payload any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(payload); err != nil {
		slog.Error("encode response", "error", err)
	}
}

func writeError(w http.ResponseWriter, err error) {
	var serviceErr *service.Error
	if errors.As(err, &serviceErr) {
		writeJSON(w, statusForCode(serviceErr.Code), map[string]any{
			"error": map[string]any{
				"code":    serviceErr.Code,
				"message": serviceErr.Message,
			},
		})
		return
	}

	slog.Error("unhandled error", "error", err)
	writeJSON(w, http.StatusInternalServerError, map[string]any{
		"error": map[string]any{
			"code":    service.CodeInternal,
			"message": "internal server error",
		},
	})
}

func statusForCode(code string) int {
	switch code {
	case service.CodeValidation:
		return http.StatusBadRequest
	case service.CodeProductNotFound:
		return http.StatusNotFound
	case service.CodeProductExists, service.CodeProductHasHistory:
		return http.StatusConflict
	case service.CodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
