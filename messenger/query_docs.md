# User Registeration
mutation Register {
  register(data: {
    email: "test.h.oxinfy@gmail.com",
    firstName: "Test",
    lastName: "Hari",
    userName: "test.h.ox",
    mobileNumber: "+919876549870",
    password: "Password@123",
    confirmPassword: "Password@123"
  }) {
    id
    email
    userName
  }
}

# User Login
mutation Login {
  login(data: {
    email: "test.h.oxinfy@gmail.com",
    password: "Password@123"
  }) {
    accessToken
    user {
      userName
      firstName
      lastName
      mobileNumber
    }
  }
}
# Update User
mutation updateProfile($data: UpdateUserInput!) {
  updateProfile(data: $data) {
    id
    firstName
    lastName
    mobileNumber
    email
    userName
  }
}
{
  "data": {
    "firstName": "TestUser",
    "lastName": "M",
    "mobileNumber": "+919999499998"
  }
}
{"Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjRiMTFjYjdhYjVmY2JlNDFlOTQ4MDk0ZTlkZjRjNWI1ZWNhMDAwOWUiLCJ0eXAiOiJKV1QifQ.eyJ0diI6MiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3VzZXItYXV0aGVudGljYXRpb24tNmNhOGQiLCJhdWQiOiJ1c2VyLWF1dGhlbnRpY2F0aW9uLTZjYThkIiwiYXV0aF90aW1lIjoxNzcwODAyNjk2LCJ1c2VyX2lkIjoiS29FejNwcGMwM2ZiZFpJYU9UZ25aRHJyNnVFMyIsInN1YiI6IktvRXozcHBjMDNmYmRaSWFPVGduWkRycjZ1RTMiLCJpYXQiOjE3NzA4MDI2OTcsImV4cCI6MTc3MDgwNjI5NywiZW1haWwiOiJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.hsXgcgNa-ywHWwILbM3YIr2UK5ql0XbZu0M5LKbnNd-gQ1Azr6PTiIxVlbg-InRsPR92dios6hcc5512q3scxTVqhTg_qN4C6kIwEswW66wIzQ1X9qieq8owk3jk0UNdz8DVDSyTm8zJ_9awREqrENp7HIh4M0sEO482QxVBgcwheVOqGYr1Rxzp95_iv4tnHXv98zY9lMzriqPJBqORLbuKep_j1cZBT3RSu9vyOfIL85chordncUw6M5IR0j9i-RJklsaekyaSolK6AddHKzqulHenMSqDWiV9XJw0jWytLjQKoC4vlwht379hdOUSjdXPiDNPOTpS92sOoEZACw"}

# Query Users 
query{
  users{
    id
    email
    userName
    mobileNumber
    firstName
    middleName
    lastName
  }
}

# Query update password 
mutation UpdatePassword($data: UpdatePasswordInput!) {
  updatePassword(data: $data) {
    id
    email
    firstName
  }
}
{
  "data": {
    "currentPassword": "Password@123",
    "newPassword": "NewPassword@123"
  }
}//test.h.oxinfy
# Forget password 
mutation {
  forgotPassword(email: "test1.h.oxinfy@gmail.com")
}
# this will generate a link we can use that link to change password

# Disable Account 
mutation {
  disableAccount {
    id
    email
    userName
    # isActive  # only if exposed in schema
  }
}
# Delete account 
# logic must be changed and need to rework
mutation DeleteAccountHard($userId: String!, $adminKey: String!) {
  deleteAccountHard(userId: $userId, adminKey: $adminKey) {
    id
    email
    userName
    firstName
    middleName
    lastName
    mobileNumber
    createdAt
  }
}

{
  "userId": "d67655ae-1e39-4a8c-bfdb-c5e6a09d5c44",
  "adminKey": "PUT_ADMIN_KEY_HERE"
}

{
  "Authorization": "Bearer eyJhbGciOiJSUzI1NiIsImtpZCI6IjRiMTFjYjdhYjVmY2JlNDFlOTQ4MDk0ZTlkZjRjNWI1ZWNhMDAwOWUiLCJ0eXAiOiJKV1QifQ.eyJ0diI6MiwiaXNzIjoiaHR0cHM6Ly9zZWN1cmV0b2tlbi5nb29nbGUuY29tL3VzZXItYXV0aGVudGljYXRpb24tNmNhOGQiLCJhdWQiOiJ1c2VyLWF1dGhlbnRpY2F0aW9uLTZjYThkIiwiYXV0aF90aW1lIjoxNzcwODAyNjk2LCJ1c2VyX2lkIjoiS29FejNwcGMwM2ZiZFpJYU9UZ25aRHJyNnVFMyIsInN1YiI6IktvRXozcHBjMDNmYmRaSWFPVGduWkRycjZ1RTMiLCJpYXQiOjE3NzA4MDI2OTcsImV4cCI6MTc3MDgwNjI5NywiZW1haWwiOiJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSIsImVtYWlsX3ZlcmlmaWVkIjpmYWxzZSwiZmlyZWJhc2UiOnsiaWRlbnRpdGllcyI6eyJlbWFpbCI6WyJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSJdfSwic2lnbl9pbl9wcm92aWRlciI6InBhc3N3b3JkIn19.hsXgcgNa-ywHWwILbM3YIr2UK5ql0XbZu0M5LKbnNd-gQ1Azr6PTiIxVlbg-InRsPR92dios6hcc5512q3scxTVqhTg_qN4C6kIwEswW66wIzQ1X9qieq8owk3jk0UNdz8DVDSyTm8zJ_9awREqrENp7HIh4M0sEO482QxVBgcwheVOqGYr1Rxzp95_iv4tnHXv98zY9lMzriqPJBqORLbuKep_j1cZBT3RSu9vyOfIL85chordncUw6M5IR0j9i-RJklsaekyaSolK6AddHKzqulHenMSqDWiV9XJw0jWytLjQKoC4vlwht379hdOUSjdXPiDNPOTpS92sOoEZACw"
}
# Enable Account in 2 stpes 
# 1
mutation {
    requestEnableAccount(email: "test.h.oxinfy@gmail.com")
  }

{
    "data": {
        "requestEnableAccount": "If the account exists, an email was sent. Enable URL: http://localhost:3001/enable-account?token=eyJhbGciOiJIUzI1NiIsInR5cCI6IkVBVCJ9.eyJzdWIiOiJiMmNkYTk1MS0wOWYyLTQyNmItOGI2Ny0xZWNjMGNlZGFkMzkiLCJ1aWQiOiJtQ1VmUUlRNDkxVXZ1dkNaR3ZtczNRUkc1Z1IyIiwiZW1haWwiOiJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSIsImp0aSI6ImM2MjA4ZDVkLTY2OWItNGU1YS05MzFjLWM5ODY0MDdiODA2NyIsImV4cCI6MTc3MDg3NDQyMn0.D5yza17zpo23R8OnVtZ9Rxa24YDHImIEdXN-zysop34"
    }
}
# 2
mutation {
    enableAccountWithToken(token: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkVBVCJ9.eyJzdWIiOiJiMmNkYTk1MS0wOWYyLTQyNmItOGI2Ny0xZWNjMGNlZGFkMzkiLCJ1aWQiOiJtQ1VmUUlRNDkxVXZ1dkNaR3ZtczNRUkc1Z1IyIiwiZW1haWwiOiJ0ZXN0Lmgub3hpbmZ5QGdtYWlsLmNvbSIsImp0aSI6ImM2MjA4ZDVkLTY2OWItNGU1YS05MzFjLWM5ODY0MDdiODA2NyIsImV4cCI6MTc3MDg3NDQyMn0.D5yza17zpo23R8OnVtZ9Rxa24YDHImIEdXN-zysop34") {
      id
      email
    }
  }