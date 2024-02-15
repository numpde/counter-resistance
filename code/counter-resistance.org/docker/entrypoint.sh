#!/bin/bash

# Stop on error
set -e

# Optional: Wait for the database to be ready
# Useful if your Django app relies on a database like PostgreSQL, MySQL, etc.
# Example for PostgreSQL:
# while ! pg_isready -h $DB_HOST -p $DB_PORT -U $DB_USER
# do
#   echo "Waiting for postgres..."
#   sleep 2
# done

# List of required environment variables
#required_env_vars=("PORT" "DB_HOST" "DB_USER" "DB_PASSWORD")
required_env_vars=("PORT" "DJANGO_DEBUG" "DJANGO_SECRET")

# Check each variable
for var in "${required_env_vars[@]}"; do
    if [ -z "${!var}" ]; then
        echo "Error: Environment variable $var is not set."
        exit 1
    fi
done


# Apply database migrations
echo "Applying database migrations..."
python manage.py migrate --noinput

# Collect static files
echo "Collecting static files..."
python manage.py collectstatic --noinput --clear

# Start Gunicorn server (or another WSGI server)
echo "Starting Gunicorn server..."
gunicorn photoveto.wsgi:application --bind 0.0.0.0:"$PORT"

# Note: Replace 'project.wsgi:application' with the appropriate WSGI application reference
# for your project, and set the $PORT environment variable in your Docker configuration.
