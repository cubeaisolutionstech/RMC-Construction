import mysql.connector

def get_db_connection():
    conn = mysql.connector.connect(
        host="localhost",
        user="root",  
        password="python",  
        database="construction"
    )
    return conn
