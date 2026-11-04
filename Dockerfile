FROM php:8.2-apache

# Install system dependencies, git, curl, SSL dev libraries for MongoDB driver
RUN apt-get update && apt-get install -y --no-install-recommends \
    libssl-dev \
    unzip \
    git \
    curl \
    ca-certificates \
    && pecl install mongodb \
    && docker-php-ext-enable mongodb \
    && a2enmod rewrite headers \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# Install Composer
COPY --from=composer:2 /usr/bin/composer /usr/bin/composer

# Install Node.js (v20 LTS) for compiling Tailwind CSS
RUN curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y --no-install-recommends nodejs \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

WORKDIR /var/www/html

# Cache dependency installations
COPY composer.json composer.lock* ./
COPY package.json package-lock* ./

RUN composer install --no-dev --optimize-autoloader --no-interaction
RUN npm ci || npm install

# Copy application source code
COPY . .

# Build production Tailwind CSS
RUN npm run build

# Remove node_modules to keep Docker image lightweight
RUN rm -rf node_modules

# Ensure proper Apache permissions
RUN chown -R www-data:www-data /var/www/html \
    && chmod -R 755 /var/www/html

# Bind to Render's dynamic PORT (defaults to 80 if not set)
ENV PORT=80
EXPOSE 80

CMD ["sh", "-c", "sed -i \"s/80/${PORT:-80}/g\" /etc/apache2/ports.conf /etc/apache2/sites-available/000-default.conf && apache2-foreground"]

