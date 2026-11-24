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
		errBody := map[string]any{
			"code":    serviceErr.Code,
			"message": serviceErr.Message,
		}
		for k, v := range serviceErr.Fields {
			errBody[k] = v
		}
		writeJSON(w, statusForCode(serviceErr.Code), map[string]any{
			"error": errBody,
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
	case service.CodeProductNotFound, service.CodeOrderNotFound:
		return http.StatusNotFound
	case service.CodeProductExists, service.CodeProductHasHistory, service.CodeInsufficientStock, service.CodeOrderAlreadyCancelled:
		return http.StatusConflict
	case service.CodeInternal:
		return http.StatusInternalServerError
	default:
		return http.StatusInternalServerError
	}
}
