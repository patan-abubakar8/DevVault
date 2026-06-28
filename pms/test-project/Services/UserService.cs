using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace MyApp.Services
{
    public class UserService
    {
        private readonly List<User> _users = new();

        public async Task<User> GetUserByIdAsync(Guid id)
        {
            return await Task.FromResult(_users.Find(u => u.Id == id));
        }

        public Task<List<User>> GetAllUsersAsync()
        {
            return Task.FromResult(_users);
        }

        public Task<User> CreateUserAsync(string name, string email, int age)
        {
            var user = new User
            {
                Id = Guid.NewGuid(),
                Name = name,
                Email = email,
                Age = age
            };
            _users.Add(user);
            return Task.FromResult(user);
        }

        public bool DeleteUser(Guid id)
        {
            var user = _users.Find(u => u.Id == id);
            if (user != null)
            {
                _users.Remove(user);
                return true;
            }
            return false;
        }

        public Task<User> UpdateUserAsync(
            Guid id,
            string name,
            string email,
            bool isActive = true)
        {
            var user = _users.Find(u => u.Id == id);
            if (user != null)
            {
                user.Name = name;
                user.Email = email;
                user.IsActive = isActive;
            }
            return Task.FromResult(user);
        }
    }

    public class User
    {
        public Guid Id { get; set; }
        public string Name { get; set; }
        public string Email { get; set; }
        public int Age { get; set; }
        public bool IsActive { get; set; }
    }
}
