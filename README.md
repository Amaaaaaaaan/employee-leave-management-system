Employee Leave Management System

A simple web-based Leave Management System built using Node.js, Express, and MySQL.

Employees can apply for leave and track status.
Managers can approve or reject leave requests.

Tech Stack

HTML, CSS, JavaScript

EJS

Node.js & Express.js

MySQL

bcrypt & JWT

How to Run

Install dependencies

npm install


Create .env file and add:

DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_password
DB_NAME=leave_mgmt
JWT_SECRET=your_secret_key
PORT=3000


Create database:

CREATE DATABASE leave_mgmt;


Start server:

npm start


Open in browser:
http://localhost:3000
