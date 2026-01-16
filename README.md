# Movie_Recommender

# Movie Recommender System (DBMS Project)

A full-stack web application that allows users to browse movies, view ratings, and manage a personalized watchlist. This project was developed as part of a Database Management Systems (DBMS) course to demonstrate efficient data handling and secure backend integration.

## Technical Stack
* **Frontend:** HTML5, CSS3, JavaScript (dynamic UI).
* **Backend:** Node.js, Express.js.
* **Database:** MySQL (Relational Database).
* **Security:** `dotenv` for environment variable management and protected database credentials.

## Project Features
* **Dynamic Movie Feed:** Fetches movie data directly from a MySQL database.
* **Database Migrations:** Includes SQL scripts for easy schema setup and trailer support.
* **Secure Architecture:** Database passwords and host details are managed via `.env` to prevent credential leakage on GitHub.
* **Promise-based Queries:** Utilizes `mysql2/promise` for non-blocking, asynchronous database operations.

## Prerequisites
* Node.js (v14 or higher)
* MySQL Server 8.0+
* VS Code

## Local Setup Instructions

1. **Clone the Repository:**
   ```bash
   git clone [https://github.com/Surajsaw-git/Movie_Recommender.git](https://github.com/Surajsaw-git/Movie_Recommender.git)
   cd "Movie Project DBMS"

2. **Database Configuration:**
    * Open MySQL Workbench and run the code inside movie_recommender.sql to create the online_movie database and tables.

    * Run the script in database_migration.sql to add trailer URL support.

3. **Configure Environment Variables:**

    * Create a .env file in the root directory.

    * Add the following variables:
        ```bash
        DB_HOST=localhost
        DB_USER=root
        DB_PASSWORD=your_password_here
        DB_DATABASE=online_movie

4. **Install Dependencies & Start:**

    ```bash

    npm install
    node server.js

5. **Access the App: Open http://localhost:3000 in your browser.**