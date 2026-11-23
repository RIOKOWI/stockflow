package service

import (
	"context"
	"strings"

	"github.com/RIOKOWI/stockflow/internal/model"
	"github.com/RIOKOWI/stockflow/internal/repository"
)

type OrderService struct {
	repo *repository.OrderRepository
}

func NewOrderService(repo *repository.OrderRepository) *OrderService {
	return &OrderService{repo: repo}
}

func (s *OrderService) Create(ctx context.Context, req model.CreateOrderRequest) (*model.SalesOrder, error) {
	customer := strings.TrimSpace(req.Customer)
	if customer == "" {
		return nil, validationError("customer is required")
	}
	if len(req.Items) == 0 {
		return nil, validationError("items must not be empty")
	}

	items := make([]model.OrderItemInput, 0, len(req.Items))
	seen := make(map[string]bool, len(req.Items))
	for _, item := range req.Items {
		sku := strings.TrimSpace(item.SKU)
		if sku == "" {
			return nil, validationError("sku is required for every item")
		}
		if item.Qty <= 0 {
			return nil, validationError("qty must be greater than zero for sku %s", sku)
		}
		if seen[sku] {
			return nil, validationError("duplicate sku %s in order", sku)
		}
		seen[sku] = true
		items = append(items, model.OrderItemInput{SKU: sku, Qty: item.Qty})
	}

	order, err := s.repo.Create(ctx, customer, items)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return order, nil
}

func (s *OrderService) Get(ctx context.Context, id int) (*model.SalesOrder, error) {
	order, err := s.repo.GetByID(ctx, id)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return order, nil
}

func (s *OrderService) Cancel(ctx context.Context, id int) (*model.SalesOrder, error) {
	order, err := s.repo.Cancel(ctx, id)
	if err != nil {
		return nil, mapRepositoryError(err)
	}
	return order, nil
}
