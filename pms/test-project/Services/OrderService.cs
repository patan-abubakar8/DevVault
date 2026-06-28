using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MyApp.Services
{
    public interface IOrderService
    {
        Task<Order> GetOrderByIdAsync(int orderId);
        Task<IEnumerable<Order>> GetOrdersByUserAsync(Guid userId);
    }

    public class OrderService : IOrderService
    {
        private readonly Dictionary<int, Order> _orders = new();

        public async Task<Order> GetOrderByIdAsync(int orderId)
        {
            _orders.TryGetValue(orderId, out var order);
            return await Task.FromResult(order);
        }

        public async Task<IEnumerable<Order>> GetOrdersByUserAsync(Guid userId)
        {
            var result = new List<Order>();
            foreach (var order in _orders.Values)
            {
                if (order.UserId == userId)
                    result.Add(order);
            }
            return await Task.FromResult(result);
        }

        public Task<Order> CreateOrderAsync(
            Guid userId,
            string productName,
            decimal amount,
            int quantity = 1)
        {
            var order = new Order
            {
                OrderId = new Random().Next(1, 999999),
                UserId = userId,
                ProductName = productName,
                Amount = amount,
                Quantity = quantity,
                CreatedAt = DateTime.UtcNow
            };
            _orders.Add(order.OrderId, order);
            return Task.FromResult(order);
        }

        public Task<decimal> CalculateTotalAsync(decimal price, int quantity, string couponCode = null)
        {
            decimal total = price * quantity;
            if (!string.IsNullOrEmpty(couponCode) && couponCode == "DISCOUNT10")
                total *= 0.9m;
            return Task.FromResult(total);
        }
    }

    public class Order
    {
        public int OrderId { get; set; }
        public Guid UserId { get; set; }
        public string ProductName { get; set; }
        public decimal Amount { get; set; }
        public int Quantity { get; set; }
        public DateTime CreatedAt { get; set; }
    }
}
