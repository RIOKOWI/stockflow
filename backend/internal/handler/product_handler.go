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

type ProductHandler struct {
	svc *service.ProductService
}

func NewProductHandler(svc *service.ProductService) *ProductHandler {
	return &ProductHandler{svc: svc}
}

func (h *ProductHandler) RegisterRoutes(r chi.Router) {
	r.Route("/api/products", func(r chi.Router) {
		r.Get("/", h.List)
		r.Post("/", h.Create)
		r.Get("/{id}", h.Get)
		r.Put("/{id}", h.Update)
		r.Delete("/{id}", h.Delete)
	})
}


func (h *ProductHandler) List(w http.ResponseWriter, r *http.Request) {
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

	filter := model.ProductFilter{
		Search:    q.Get("search"),
		SortBy:    sortBy,
		SortOrder: sortOrder,
		Page:      page,
		Limit:     limit,
	}

	if v := q.Get("min_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, &service.Error{Code: service.CodeValidation, Message: "min_price must be an integer"})
			return
		}
		filter.MinPrice = &n
	}
	if v := q.Get("max_price"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil {
			writeError(w, &service.Error{Code: service.CodeValidation, Message: "max_price must be an integer"})
			return
		}
		filter.MaxPrice = &n
	}

	result, err := h.svc.List(r.Context(), filter)
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
		"message": "Products retrieved successfully",
		"data":    result.Products,
		"meta": map[string]any{
			"page":        result.Page,
			"limit":       result.Limit,
			"total":       result.Total,
			"total_pages": totalPages,
		},
	})
}


func (h *ProductHandler) Create(w http.ResponseWriter, r *http.Request) {
	var req model.CreateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, &service.Error{Code: service.CodeValidation, Message: "invalid JSON body"})
		return
	}

	product, err := h.svc.Create(r.Context(), req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusCreated, map[string]any{
		"success": true,
		"message": "Product created successfully",
		"data":    product,
	})
}


func (h *ProductHandler) Get(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	product, err := h.svc.Get(r.Context(), id)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Product retrieved successfully",
		"data":    product,
	})
}


func (h *ProductHandler) Update(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	var req model.UpdateProductRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeError(w, &service.Error{Code: service.CodeValidation, Message: "invalid JSON body"})
		return
	}

	product, err := h.svc.Update(r.Context(), id, req)
	if err != nil {
		writeError(w, err)
		return
	}

	writeJSON(w, http.StatusOK, map[string]any{
		"success": true,
		"message": "Product updated successfully",
		"data":    product,
	})
}


func (h *ProductHandler) Delete(w http.ResponseWriter, r *http.Request) {
	id, ok := parseID(w, r)
	if !ok {
		return
	}

	if err := h.svc.Delete(r.Context(), id); err != nil {
		writeError(w, err)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}


func parseID(w http.ResponseWriter, r *http.Request) (int, bool) {
	raw := chi.URLParam(r, "id")
	id, err := strconv.Atoi(raw)
	if err != nil || id < 1 {
		writeError(w, &service.Error{Code: service.CodeValidation, Message: "id must be a positive integer"})
		return 0, false
	}
	return id, true
}
