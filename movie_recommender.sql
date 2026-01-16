-- Create the database 
CREATE DATABASE online_movie; 

-- Use the created database 
USE online_movie; 

-- Create the user table 
CREATE TABLE user ( 
userId INT PRIMARY KEY, 
userName VARCHAR(100), 
emailId VARCHAR(100), 
joinDate DATE 
); 

-- Insert data into the user table 
INSERT INTO user (userId, userName, emailId, joinDate) VALUES 
(1, 'SURAJ SAW', 'suraj@gmail.com', '2020-01-15'), 
(2, 'Arsh Imam', 'arsh@gmail.com', '2022-09-12'), 
(3, 'Sagar Kumar', 'sagar@gmail.com', '2012-02-02'), 
(4, 'Sa sh Saw', 'sa sh@gmail.com', '2018-04-02'), 
(5, 'Shubham Raj', 'shubham@gmail.com', '2025-12-22'), 
(6, 'Harshad Gole', 'harshad@gmail.com', '2005-10-20'); 

-- Create the director table 
CREATE TABLE IF NOT EXISTS director ( 
directorId INT PRIMARY KEY, 
directorName VARCHAR(100) 
); 

-- Insert data into the director table 
INSERT INTO director (directorId, directorName) VALUES 
(101, 'S.S Rajamouli'), 
(102, 'Prashant Neel'), 
(103, 'Atlee Kumar'), 
(104, 'Sandeep Reddy Vanga'), 
(105, 'Raj Kumar Hirani'); 

-- Create the movie table 
CREATE TABLE IF NOT EXISTS movie ( 
movieId INT PRIMARY KEY, 
tleName VARCHAR(100), 
releaseYear YEAR, 
directorId INT, 
FOREIGN KEY (directorId) REFERENCES director(directorId) 
); 

-- Insert data into the movie table 
INSERT INTO movie (movieId, tleName, releaseYear, directorId) VALUES 
(1001, 'Baahubali', 2015, 101), 
(1002, 'Baahubali 2', 2017, 101), 
(1003, 'KGF', 2018, 102), 
(1004, 'KGF 2', 2022, 102), 
(1005, 'Animal', 2023, 104), 
(1006, 'Jawan', 2024, 103), 
(1007, 'P K', 2014, 105), 
(1008, 'Salaar', 2024, 102); 


-- Create the actor table 
CREATE TABLE IF NOT EXISTS actor ( 
actorId INT PRIMARY KEY, 
actorName VARCHAR(100) 
); 


-- Insert data into the actor table 
INSERT INTO actor (actorId, actorName) VALUES 
(10001, 'Prabhas'), 
(10002, 'SRK'), 
(10003, 'Yash'), 
(10004, 'Ranbir'), 
(10005, 'Amir'); 


-- Create the genre table 
CREATE TABLE IF NOT EXISTS genre ( 
genreId INT PRIMARY KEY, 
genreName VARCHAR(100) 
); 


-- Insert data into the genre table 
INSERT INTO genre (genreId, genreName) VALUES 
(1, 'Mo on'), 
(2, 'Ac on'), 
(3, 'Crime'), 
(4, 'Comedy'); 
 
 
 
-- Create the ra ngs table 
CREATE TABLE IF NOT EXISTS ra ngs ( 
    userId INT, 
    movieId INT, 
    ra ng DECIMAL(2,1), 
    ` meStamp` DATETIME, 
    PRIMARY KEY (userId, movieId), 
    FOREIGN KEY (userId) REFERENCES user(userId), 
    FOREIGN KEY (movieId) REFERENCES movie(movieId) 
); 
 

-- Insert data into the ra ngs table 
INSERT INTO ra ngs (userId, movieId, ra ng, ` meStamp`) VALUES 
(1, 1001, 5.0, '2025-09-09 00:29:17'), 
(1, 1006, 3.1, '2025-09-09 00:40:25'), 
(1, 1007, 3.7, '2025-09-09 00:40:25'), 
(1, 1008, 4.1, '2025-09-09 00:40:25'), 
(2, 1001, 5.0, '2025-09-09 00:40:25'), 
(2, 1002, 4.5, '2025-09-09 00:40:25'), 
(2, 1003, 3.0, '2025-09-09 00:40:25'), 
(2, 1007, 3.5, '2025-09-09 00:40:25'), 
(2, 1008, 2.1, '2025-09-09 00:40:25'), 
(3, 1007, 3.7, '2025-09-09 00:40:25'), 
(4, 1007, 3.7, '2025-09-09 00:40:25'), 
(5, 1007, 4.7, '2025-09-09 00:40:25'), 
(6, 1007, 4.7, '2025-09-09 00:40:25'); 
 
-- Create the movie_genre table 
CREATE TABLE IF NOT EXISTS movie_genre ( 
    movieId INT, 
    genreId INT, 
    PRIMARY KEY (movieId, genreId), 
    FOREIGN KEY (movieId) REFERENCES movie(movieId), 
    FOREIGN KEY (genreId) REFERENCES genre(genreId) 
); 


-- Insert data into the movie_genre table 
INSERT INTO movie_genre (movieId, genreId) VALUES 
(1001, 1), 
(1002, 1), 
(1002, 2), 
(1002, 3), 
(1002, 4), 
(1007, 4); 
 
 
CREATE TABLE Movie_Ra ngs_UNF ( 
    userId INT, 
    userName VARCHAR(50), 
    movieId INT, 
    movieTitle VARCHAR(100), 
    directorName VARCHAR(50), 
    genres VARCHAR(100),  -- Mul-valued field 
    ra ng DECIMAL(2,1) 
); 
 
INSERT INTO Movie_Ra ngs_UNF VALUES 
(1, 'SURAJ SAW', 1001, 'Baahubali', 'S.S RAJAMOULI', 'Mo on, Ac on', 5.0), 
(2, 'ARSH IMAM', 1003, 'KGF', 'PRASHANT NEEL', 'Ac on, Crime', 3.0), 
(1, 'SURAJ SAW', 1006, 'Jawan', 'ATLEE KUMAR', 'Ac on, Crime', 3.1); 


-- Display UNF 
SELECT * FROM Movie_Ra ngs_UNF; 
 
CREATE TABLE Movie_Ra ngs_1NF ( 
    userId INT, 
    userName VARCHAR(50), 
    movieId INT, 
    movieTitle VARCHAR(100), 
    directorName VARCHAR(50), 
    genre VARCHAR(30), 
    ra ng DECIMAL(2,1) 
); 
 
INSERT INTO Movie_Ra ngs_1NF VALUES 
(1, 'SURAJ SAW', 1001, 'Baahubali', 'S.S RAJAMOULI', 'Mo on', 5.0), 
(1, 'SURAJ SAW', 1001, 'Baahubali', 'S.S RAJAMOULI', 'Ac on', 5.0), 
(2, 'ARSH IMAM', 1003, 'KGF', 'PRASHANT NEEL', 'Ac on', 3.0), 
(2, 'ARSH IMAM', 1003, 'KGF', 'PRASHANT NEEL', 'Crime', 3.0), 
(1, 'SURAJ SAW', 1006, 'Jawan', 'ATLEE KUMAR', 'Ac on', 3.1), 
(1, 'SURAJ SAW', 1006, 'Jawan', 'ATLEE KUMAR', 'Crime', 3.1); 


-- Display 1NF 
SELECT * FROM Movie_Ra ngs_1NF; 
CREATE TABLE IF NOT EXISTS movie_actor ( 
    movieId INT, 
    actorId INT, 
    PRIMARY KEY (movieId, actorId), 
    FOREIGN KEY (movieId) REFERENCES movie(movieId), 
    FOREIGN KEY (actorId) REFERENCES actor(actorId) 
); 

-- Insert data into the movie_actor table 
INSERT INTO movie_actor (movieId, actorId) VALUES 
(1001, 10001), 
(1002, 10001), 
(1003, 10003), 
(1004, 10003), 
(1005, 10004), 
(1006, 10002), 
(1007, 10005), 
(1008, 10001); 


CREATE VIEW recent_movies AS 
SELECT tleName, releaseYear 
FROM movie 
WHERE releaseYear > 2020; 


CREATE VIEW movie_avg_ra ng AS 
SELECT m. tleName, AVG(r.ra ng) AS avg_ra ng 
FROM movie m 
JOIN ra ngs r ON m.movieId = r.movieId 
GROUP BY m. tleName; 


CREATE OR REPLACE VIEW user_movie_ra ng AS 
SELECT u.userName, m. tleName, r.ra ng 
FROM user u 
JOIN ra ngs r ON u.userId = r.userId 
JOIN movie m ON m.movieId = r.movieId; 
CREATE OR REPLACE VIEW top_rated_movies AS 
SELECT tleName, avg_ra ng 
FROM movie_avg_ra ng 
WHERE avg_ra ng > 4.0; 


CREATE TABLE IF NOT EXISTS produc on_house ( 
prodId INT PRIMARY KEY, 
prodName VARCHAR(100) 
); 


-- Insert data into the produc on_house table 
INSERT INTO produc on_house (prodId, prodName) VALUES 
(1, 'Hombale Films'), 
(2, 'Dharma Produc ons'), 
(3, 'T-Series');


CREATE TABLE IF NOT EXISTS movie_produc on ( 
movieId INT, 
prodId INT, 
PRIMARY KEY (movieId, prodId), 
FOREIGN KEY (movieId) REFERENCES movie(movieId), 
FOREIGN KEY (prodId) REFERENCES produc on_house(prodId) 
); 


-- Insert data into the movie_produc on table 
INSERT INTO movie_produc on (movieId, prodId) VALUES 
(1001, 1), 
(1003, 1), 
(1004, 1), 
(1008, 1), 
(1005, 3), 
(1006, 2), 
(1007, 2); 


ALTER TABLE user ADD CONSTRAINT unique_email UNIQUE(emailId); 
ALTER TABLE ra ngs ADD CONSTRAINT chk_ra ng CHECK (ra ng >= 0 AND ra ng <= 5); 
ALTER TABLE movie MODIFY tleName VARCHAR(50) NOT NULL; 
CREATE VIEW view_movie_ra ng AS 
SELECT u.userName, m. tleName, r.ra ng 
FROM user u 
JOIN ra ngs r ON u.userId = r.userId 
JOIN movie m ON m.movieId = r.movieId; 
SELECT m. tleName, AVG(r.ra ng) AS average_ra ng 
FROM movie m 
JOIN ra ngs r ON m.movieId = r.movieId 
GROUP BY m. tleName;


SELECT COUNT(*) AS total_users FROM user; 
SELECT MAX(ra ng) AS highest_ra ng, MIN(ra ng) AS lowest_ra ng FROM ra ngs; 
SELECT userId, SUM(ra ng) AS total_ra ng_points 
FROM ra ngs 
GROUP BY userId;


SELECT m. tleName, AVG(r.ra ng) AS avg_ra ng 
FROM movie m 
JOIN ra ngs r ON m.movieId = r.movieId 
GROUP BY m. tleName 
HAVING avg_ra ng > 4;


SELECT u.userName, m. tleName, r.ra ng 
FROM user u 
INNER JOIN ra ngs r ON u.userId = r.userId 
INNER JOIN movie m ON m.movieId = r.movieId; 
SELECT m. tleName, r.ra ng 
FROM movie m 
LEFT JOIN ra ngs r ON m.movieId = r.movieId; 
CREATE VIEW movie_info AS 
SELECT movieId, tleName, directorId 
FROM movie;

CREATE VIEW movie_director_view AS 
SELECT m. tleName AS Movie, d.directorName AS Director 
FROM movie m 
JOIN director d ON m.directorId = d.directorId; 
CREATE VIEW recent_movies AS 
SELECT tleName, releaseYear 
FROM movie 
WHERE releaseYear > 2020;


CREATE VIEW movie_avg_ra ng AS 
SELECT m. tleName, AVG(r.ra ng) AS avg_ra ng 
FROM movie m 
JOIN ra ngs r ON m.movieId = r.movieId 
GROUP BY m. tleName;


CREATE VIEW top_rated_movies AS 
SELECT tleName, avg_ra ng 
FROM movie_avg_ra ng 
WHERE avg_ra ng > 4.0;


CREATE VIEW user_movie_ra ng AS 
SELECT u.userName, m. tleName, r.ra ng 
FROM user u 
JOIN ra ngs r ON u.userId = r.userId 
JOIN movie m ON m.movieId = r.movieId; 
SHOW FULL TABLES WHERE TABLE_TYPE = 'VIEW';


CREATE VIEW view_movie_details AS 
SELECT  
    m.movieId, 
    m. tleName AS Movie_Name, 
    d.directorName AS Director_Name, 
    a.actorName AS Actor_Name, 
    p.prodName AS Produc on_House 
FROM movie m 
JOIN director d  
    ON m.directorId = d.directorId 
JOIN movie_actor ma  
    ON m.movieId = ma.movieId 
JOIN actor a  
    ON ma.actorId = a.actorId 
JOIN movie_produc on mp  
    ON m.movieId = mp.movieId 
JOIN produc on_house p  
    ON mp.prodId = p.prodId; 
 
DELIMITER // 


CREATE PROCEDURE display_movie_ra ngs(IN mid INT) 
BEGIN 
    SELECT m. tleName, r.ra ng, u.userName 
    FROM ra ngs r 
    JOIN movie m ON r.movieId = m.movieId 
    JOIN user u ON r.userId = u.userId 
    WHERE r.movieId = mid; 
END // 


DELIMITER ; 

CALL display_movie_ra ngs(1001); 

DELIMITER // 
CREATE TRIGGER before_ra ng_insert 
BEFORE INSERT ON ra ngs 
FOR EACH ROW 
BEGIN 
IF NEW.ra ng > 5 THEN 
SET NEW.ra ng = 5; 
END IF; 
END // 
DELIMITER ; 
DELIMITER // 
CREATE FUNCTION avg_ra ng(mid INT) 
RETURNS DECIMAL(3,2) 
DETERMINISTIC 
BEGIN 
DECLARE avg_val DECIMAL(3,2); 
SELECT AVG(ra ng) INTO avg_val FROM ra ngs WHERE movieId = mid; 
RETURN avg_val; 
END // 
DELIMITER ; 
SELECT avg_ra ng(1001) AS Average_Ra ng; 
INSERT INTO ra ngs (userId, movieId, ra ng, ` meStamp`) VALUES 
(6, 1006, 4.7, '2025-09-09 00:29:17');


show tables; 

desc movie; 


create view v1 as select movieId, tleName,directorId from movie; 
select * from v1; 
create view v2 as select movieId, tleName from v1; 
select * from v2; 
insert into v2 values (1011,'3 Idiots'); 
select * from movie;


/* 
* Run these commands on your `online_movie` database 
* to add the features you requested. 
*/ -- 1. Add a password column to your user table -- (We will store passwords in plain text for this demo, -- but in a real app, you MUST "hash" them with a library like 'bcrypt') 
ALTER TABLE user 
ADD COLUMN password VARCHAR(255) NOT NULL; 

-- 1. Select your database 
USE online_movie; 

-- 2. Temporarily remove the foreign key constraint "lock" -- from the 'ra ngs' table. 
ALTER TABLE ra ngs 
DROP FOREIGN KEY ra ngs_ib _1; 

-- 3. Now that the 'user' table is "unlocked", -- we can add AUTO_INCREMENT. -- (We are NOT adding 'PRIMARY KEY' again, as it's already the key) 
ALTER TABLE user 
MODIFY COLUMN userId INT AUTO_INCREMENT; 

-- 4. Re-add the foreign key "lock" to the 'ra ngs' table -- to restore your database integrity. 
ALTER TABLE ra ngs 
ADD CONSTRAINT ra ngs_ib _1 
FOREIGN KEY (userId) REFERENCES user(userId); 
show tables; 
select*from ra ngs; 

-- Select your database 
USE online_movie; 

-- Add a column to the movie table to store a URL to a poster 
ALTER TABLE movie 
ADD COLUMN imageUrl VARCHAR(512) DEFAULT NULL; 

-- This script fixes all your Primary Keys to be AUTO_INCREMENT. -- This will fix the "doesn't have a default value" error -- for ALL your tables in the admin panel. 
USE online_movie; 

-- 1. Temporarily disable the Foreign Key "locks" 
SET FOREIGN_KEY_CHECKS=0; 

-- 2. Modify all your primary key columns to ADD AUTO_INCREMENT 
-- (We are just adding AUTO_INCREMENT, not re-defining the primary key) 
ALTER TABLE movie MODIFY COLUMN movieId INT AUTO_INCREMENT; 
ALTER TABLE director MODIFY COLUMN directorId INT AUTO_INCREMENT; 
ALTER TABLE actor MODIFY COLUMN actorId INT AUTO_INCREMENT; 
ALTER TABLE genre MODIFY COLUMN genreId INT AUTO_INCREMENT; 
ALTER TABLE produc on_house MODIFY COLUMN prodId INT AUTO_INCREMENT; 

-- 3. Re-enable the "locks". Your database is now consistent. 
SET FOREIGN_KEY_CHECKS=1; 
select * from user; 
CREATE TABLE IF NOT EXISTS watchlist ( 
userId INT, 
movieId INT, 
PRIMARY KEY (userId, movieId) 
);