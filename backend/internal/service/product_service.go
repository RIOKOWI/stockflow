package service

import (
	"context"
	"errors"
	"fmt"
	"strings"

	"github.com/RIOKOWI/stockflow/internal/model"
	"github.com/RIOKOWI/stockflow/internal/repository"
)

const (
	CodeValidation            = "VALIDATION_ERROR"
	CodeProductNotFound       = "PRODUCT_NOT_FOUND"
	CodeProductExists         = "PRODUCT_ALREADY_EXISTS"
	CodeProductHasHistory     = "PRODUCT_HAS_HISTORY"
	CodeInsufficientStock     = "INSUFFICIENT_STOCK"
	CodeOrderNotFound         = "ORDER_NOT_FOUND"
	CodeOrderAlreadyCancelled = "ORDER_ALREADY_CANCELLED"
	CodeInternal              = "INTERNAL_SERVER_ERROR"
)

type Error struct {
	Code    string
	Message string
	Fields  map[string]any
}

func (e *Error) Error() string {
	return e.Code + ": " + e.Message
}

func validationError(format string, args ...any) *Error {
	return &Error{Code: CodeValidation, Message: fmt.Sprintf(format, args...)}
}

type ProductService struct {
	repo *repository.ProductRepository
}

func NewProductService(repo *repository.ProductRepository) *ProductService {
	return &ProductService{repo: repo}
}

var sortColumns = map[string]bool{
	"name":       true,
	"price":      true,
	"stock":      true,
	"created_at": true,
}

func (s *ProductService) Create(ctx context.Context, req model.CreateProductRequest) (*model.Product, error) {
	sku := strings.TrimSpace(req.SKU)
	name := strings.TrimSpace(req.Name)

	if sku == "" {
		return nil, validationError("sku is required")
	}
	if name == "" {
		return nil, validationError("name is required")
	}
	if req.Price < 0 {
		return nil, validationError("price must not be negative")
	}

	product, err := s.repo.Create(ctx, &model.Product{SKU: sku, Name: name, Price: req.Price})
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return product, nil
}

func (s *ProductService) List(ctx context.Context, filter model.ProductFilter) (model.ProductList, error) {
	if filter.Page < 1 {
		return model.ProductList{}, validationError("page must be greater than zero")
	}
	if filter.Limit < 1 || filter.Limit > 100 {
		return model.ProductList{}, validationError("limit must be between 1 and 100")
	}
	if !sortColumns[filter.SortBy] {
		return model.ProductList{}, validationError("sort must be one of name, price, stock, created_at")
	}
	if filter.SortOrder != "asc" && filter.SortOrder != "desc" {
		return model.ProductList{}, validationError("order must be asc or desc")
	}
	if filter.MinPrice != nil && *filter.MinPrice < 0 {
		return model.ProductList{}, validationError("min_price must not be negative")
	}
	if filter.MaxPrice != nil && *filter.MaxPrice < 0 {
		return model.ProductList{}, validationError("max_price must not be negative")
	}
	if filter.MinPrice != nil && filter.MaxPrice != nil && *filter.MinPrice > *filter.MaxPrice {
		return model.ProductList{}, validationError("min_price must not be greater than max_price")
	}

	products, total, err := s.repo.List(ctx, filter)
	if err != nil {
		return model.ProductList{}, mapRepositoryError(err)
	}
	return model.ProductList{Products: products, Page: filter.Page, Limit: filter.Limit, Total: total}, nil
}

func (s *ProductService) Get(ctx context.Context, id int) (*model.Product, error) {
	product, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return product, nil
}

func (s *ProductService) Update(ctx context.Context, id int, req model.UpdateProductRequest) (*model.Product, error) {
	sku := strings.TrimSpace(req.SKU)
	name := strings.TrimSpace(req.Name)

	if sku == "" {
		return nil, validationError("sku is required")
	}
	if name == "" {
		return nil, validationError("name is required")
	}
	if req.Price < 0 {
		return nil, validationError("price must not be negative")
	}
	if req.Stock != nil && *req.Stock < 0 {
		return nil, validationError("stock must not be negative")
	}

	product, err := s.repo.Update(ctx, id, sku, name, req.Price, req.Stock)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return product, nil
}

func (s *ProductService) Delete(ctx context.Context, id int) error {
	if err := s.repo.Delete(ctx, id); err != nil {
		return mapRepositoryError(err)
	}
	return nil
}

func (s *ProductService) AdjustStock(ctx context.Context, id int, req model.StockAdjustmentRequest) (*model.StockAdjustmentResult, error) {
	if req.Type != model.MovementIn && req.Type != model.MovementOut {
		return nil, validationError("type must be one of in, out")
	}
	if req.Qty <= 0 {
		return nil, validationError("qty must be greater than zero")
	}

	result, err := s.repo.AdjustStock(ctx, id, req.Type, req.Qty, req.Note)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return result, nil
}

func (s *ProductService) ListMovements(ctx context.Context, id int) ([]model.StockMovement, error) {
	if _, err := s.repo.GetByID(ctx, id); err != nil {
		return nil, mapRepositoryError(err)
	}

	movements, err := s.repo.ListMovements(ctx, id)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return movements, nil
}

func mapRepositoryError(err error) error {
	var insufficient *repository.InsufficientStockError
	var unknownSKU *repository.UnknownSKUError
	var inactive *repository.InactiveProductError
	switch {
	case errors.As(err, &insufficient):
		fields := map[string]any{"available": insufficient.Available}
		if insufficient.SKU != "" {
			fields["sku"] = insufficient.SKU
		}
		return &Error{
			Code:    CodeInsufficientStock,
			Message: "insufficient stock",
			Fields:  fields,
		}
	case errors.As(err, &unknownSKU):
		return validationError("sku %s does not exist", unknownSKU.SKU)
	case errors.As(err, &inactive):
		return validationError("product %s is inactive", inactive.SKU)
	case errors.Is(err, repository.ErrOrderNotFound):
		return &Error{Code: CodeOrderNotFound, Message: "order not found"}
	case errors.Is(err, repository.ErrOrderAlreadyCancelled):
		return &Error{Code: CodeOrderAlreadyCancelled, Message: "order already cancelled"}
	case errors.Is(err, repository.ErrNotFound):
		return &Error{Code: CodeProductNotFound, Message: "product not found"}
	case errors.Is(err, repository.ErrDuplicateSKU):
		return &Error{Code: CodeProductExists, Message: "sku already exists"}
	case errors.Is(err, repository.ErrHasHistory):
		return &Error{Code: CodeProductHasHistory, Message: "product has stock movement or order history"}
	default:
		return err
	}
}
