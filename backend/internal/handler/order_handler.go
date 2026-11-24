package handler

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/RIOKOWI/stockflow/internal/model"
	"github.com/RIOKOWI/stockflow/internal/service"
	"github.com/go-chi/chi/v5"
)

type OrderHandler struct {
	svc *service.OrderService
}

func NewOrderHandler(svc *service.OrderService) *OrderHandler {
	return &OrderHandler{svc: svc}
}

func (h *OrderHandler) RegisterRoutes(r chi.Router) {
	r.Route("/api/orders", func(r chi.Router) {
		r.Get("/", h.List)
		r.Post("/", h.Create)
		r.Get("/{id}", h.Get)
		r.Post("/{id}/cancel", h.Cancel)
	})
}

func (h *OrderHandler) List(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()

	page := 1
	if v := q.Get("page"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			writeError(w, &service.Error{Code: service.CodeValidation, Message: "page must be a positive integer"})
			return
		}
		page = n
	}

	limit := 10
	if v := q.Get("limit"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 1 {
			writeError(w, &service.Error{Code: service.CodeValidation, Message: "limit must be a positive integer"})
			return
		}
		limit = n
	}

	sortBy := q.Get("sort_by")
	if sortBy == "" {
		sortBy = "created_at"
	}

	sortOrder := strings.ToLower(q.Get("sort_order"))
	if sortOrder == "" {
		sortOrder = "desc"
	}

	result, err := h.svc.List(r.Context(), model.OrderFilter{
		Search:    q.Get("search"),
		SortBy:    sortBy,
		SortOrder: sortOrder,
		Page:      page,
		Limit:     limit,
	})
	if err != nil {
		writeError(w, err)
		return
	}

	totalPages := (result.Total + result.Limit - 1) / result.Limit
	if totalPages < 1 {
		totalPages = 1
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Orders retrieved successfully",
		"data":    result.Orders,
		"meta": map[string]any{
			"page":        result.Page,
			"limit":       result.Limit,
			"total":       result.Total,
			"total_pages": totalPages,
		},
	})
}

func (h *OrderHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateOrderRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, &service.Error{Code: service.CodeValidation, Message: "invalid JSON body"})
		return
	}

	order, err := h.svc.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"message": "Order created successfully",
		"data":    order,
	})
}

func (h *OrderHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseOrderID(w, r)
	if !ok {
		return
	}

	order, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Order retrieved successfully",
		"data":    order,
	})
}

func (h *OrderHandler) Cancel(w http.ResponseWriter, r *http.Request) {
	id, ok := parseOrderID(w, r)
	if !ok {
		return
	}

	order, err := h.svc.Cancel(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Order cancelled successfully",
		"data":    order,
	})
}

func parseOrderID(w http.ResponseWriter, r *http.Request) (int, bool) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.Atoi(raw)
	if err != nil || id < 1 {
		writeError(w, &service.Error{Code: service.CodeValidation, Message: "id must be a positive integer"})
		return 0, false
	}
	return id, true
}
