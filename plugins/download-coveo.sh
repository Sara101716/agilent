#!/bin/bash

# Coveo Headless SDK and Bueno Download Script for AEM Edge Delivery Services
# Place this file in: /c/aem-live/da-tutorial-main/plugin/download-coveo.sh
# Downloads headless files to: /c/aem-live/da-tutorial-main/scripts/coveo/headless/
# Downloads bueno file to: /c/aem-live/da-tutorial-main/scripts/coveo/bueno/v1.0.21/
# Features: Automatic backup of existing files

set -e  # Exit on any error

# Configuration
HEADLESS_DOWNLOAD_DIR="../scripts/coveo/headless"
BUENO_DOWNLOAD_DIR="../scripts/coveo/bueno/v1.0.21"
HEADLESS_URL="https://static.cloud.coveo.com/headless/v3.27.4/headless.esm.js"
HEADLESS_MAP_URL="https://static.cloud.coveo.com/headless/v3.27.4/headless.esm.js.map"
BUENO_URL="https://static.cloud.coveo.com/bueno/v1.0.21/bueno.esm.js"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_backup() {
    echo -e "${YELLOW}[BACKUP]${NC} $1"
}

# Function to check if command exists
command_exists() {
    command -v "$1" >/dev/null 2>&1
}

# Function to create backup of existing file
backup_file() {
    local file_path="$1"
    local file_name=$(basename "$file_path")
    
    if [[ -f "$file_path" ]]; then
        local timestamp=$(date +%Y%m%d_%H%M%S)
        local backup_path="${file_path}.backup.${timestamp}"
        
        if cp "$file_path" "$backup_path"; then
            print_backup "Created backup: $file_name -> $(basename "$backup_path")"
            return 0
        else
            print_error "Failed to create backup for $file_name"
            return 1
        fi
    fi
    return 0
}

# Function to backup existing files
backup_existing_files() {
    local headless_file="$HEADLESS_DOWNLOAD_DIR/headless.esm.js"
    local map_file="$HEADLESS_DOWNLOAD_DIR/headless.esm.js.map"
    local bueno_file="$BUENO_DOWNLOAD_DIR/bueno.esm.js"
    local backup_needed=false
    
    # Check if any files exist
    if [[ -f "$headless_file" ]] || [[ -f "$map_file" ]] || [[ -f "$bueno_file" ]]; then
        backup_needed=true
        print_status "Existing files detected. Creating backups..."
        echo
    fi
    
    if [[ "$backup_needed" == true ]]; then
        # Backup each file if it exists
        backup_file "$headless_file"
        backup_file "$map_file"
        backup_file "$bueno_file"
        echo
        print_success "Backup process completed."
        echo
    fi
}

# Check prerequisites
check_prerequisites() {
    print_status "Checking prerequisites..."
    
    if ! command_exists curl && ! command_exists wget; then
        print_error "Neither curl nor wget is available. Please install one of them."
        exit 1
    fi
    
    print_success "Prerequisites check completed."
}

# Create directory structure
create_directories() {
    print_status "Creating directory structure..."
    
    # Create directories for headless files and bueno file
    mkdir -p "$HEADLESS_DOWNLOAD_DIR"
    mkdir -p "$BUENO_DOWNLOAD_DIR"
    
    print_success "Directory structure created:"
    print_success "  Headless: $(realpath "$HEADLESS_DOWNLOAD_DIR" 2>/dev/null || echo "$HEADLESS_DOWNLOAD_DIR")"
    print_success "  Bueno: $(realpath "$BUENO_DOWNLOAD_DIR" 2>/dev/null || echo "$BUENO_DOWNLOAD_DIR")"
}

# Download Coveo files
download_coveo_files() {
    print_status "Downloading Coveo files..."
    
    print_status "CDN URLs:"
    print_status "  Headless: $HEADLESS_URL"
    print_status "  Source Map: $HEADLESS_MAP_URL"
    print_status "  Bueno: $BUENO_URL"
    
    local download_cmd
    local headless_file="$HEADLESS_DOWNLOAD_DIR/headless.esm.js"
    local map_file="$HEADLESS_DOWNLOAD_DIR/headless.esm.js.map"
    local bueno_file="$BUENO_DOWNLOAD_DIR/bueno.esm.js"
    
    # Choose download command
    if command_exists curl; then
        download_cmd="curl -L -o"
        print_status "Using curl for download..."
    elif command_exists wget; then
        download_cmd="wget -O"
        print_status "Using wget for download..."
    fi
    
    # Download main headless SDK file
    print_status "Downloading headless.esm.js..."
    if $download_cmd "$headless_file" "$HEADLESS_URL"; then
        print_success "Downloaded headless.esm.js (version 3.27.4)"
    else
        print_error "Failed to download headless.esm.js from $HEADLESS_URL"
        print_error "Please check your internet connection and try again."
        exit 1
    fi
    
    # Download source map
    print_status "Downloading headless.esm.js.map..."
    if $download_cmd "$map_file" "$HEADLESS_MAP_URL"; then
        print_success "Downloaded headless.esm.js.map"
    else
        print_warning "Failed to download source map (not critical for production)"
    fi
    
    # Download Bueno validation library
    print_status "Downloading bueno.esm.js..."
    if $download_cmd "$bueno_file" "$BUENO_URL"; then
        print_success "Downloaded bueno.esm.js (version 1.0.21)"
    else
        print_error "Failed to download bueno.esm.js from $BUENO_URL"
        print_error "This will cause import errors in headless.esm.js"
        exit 1
    fi
}

# Verify downloads
verify_downloads() {
    print_status "Verifying downloads..."
    
    local headless_file="$HEADLESS_DOWNLOAD_DIR/headless.esm.js"
    local bueno_file="$BUENO_DOWNLOAD_DIR/bueno.esm.js"
    
    # Verify headless.esm.js
    if [[ -f "$headless_file" ]]; then
        local file_size=$(stat -f%z "$headless_file" 2>/dev/null || stat -c%s "$headless_file" 2>/dev/null || echo "0")
        if [[ "$file_size" -gt 10000 ]]; then
            print_success "Coveo Headless SDK downloaded successfully"
            print_success "  File: $(realpath "$headless_file" 2>/dev/null || echo "$headless_file")"
            print_success "  Size: ${file_size} bytes"
            print_success "  Version: 3.27.4"
        else
            print_error "Downloaded headless.esm.js file seems too small (${file_size} bytes)"
            exit 1
        fi
    else
        print_error "headless.esm.js not found at $headless_file"
        exit 1
    fi
    
    # Verify bueno.esm.js
    if [[ -f "$bueno_file" ]]; then
        local bueno_size=$(stat -f%z "$bueno_file" 2>/dev/null || stat -c%s "$bueno_file" 2>/dev/null || echo "0")
        if [[ "$bueno_size" -gt 1000 ]]; then
            print_success "Coveo Bueno validation library downloaded successfully"
            print_success "  File: $(realpath "$bueno_file" 2>/dev/null || echo "$bueno_file")"
            print_success "  Size: ${bueno_size} bytes"
            print_success "  Version: 1.0.21"
        else
            print_error "Downloaded bueno.esm.js file seems too small (${bueno_size} bytes)"
            exit 1
        fi
    else
        print_error "bueno.esm.js not found at $bueno_file"
        exit 1
    fi
}

# List backup files
list_backup_files() {
    print_status "Checking for existing backup files..."
    
    local backup_files_headless=$(find "$HEADLESS_DOWNLOAD_DIR" -name "*.backup.*" 2>/dev/null || true)
    local backup_files_bueno=$(find "$BUENO_DOWNLOAD_DIR" -name "*.backup.*" 2>/dev/null || true)
    
    if [[ -n "$backup_files_headless" ]] || [[ -n "$backup_files_bueno" ]]; then
        echo
        print_warning "Found existing backup files:"
        
        if [[ -n "$backup_files_headless" ]]; then
            echo "  Headless backups:"
            echo "$backup_files_headless" | while read -r backup_file; do
                if [[ -n "$backup_file" ]]; then
                    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
                    echo "    - $(basename "$backup_file") (${file_size} bytes)"
                fi
            done
        fi
        
        if [[ -n "$backup_files_bueno" ]]; then
            echo "  Bueno backups:"
            echo "$backup_files_bueno" | while read -r backup_file; do
                if [[ -n "$backup_file" ]]; then
                    local file_size=$(stat -f%z "$backup_file" 2>/dev/null || stat -c%s "$backup_file" 2>/dev/null || echo "0")
                    echo "    - $(basename "$backup_file") (${file_size} bytes)"
                fi
            done
        fi
        
        echo
        print_warning "Consider cleaning up old backups to save disk space:"
        echo "  find scripts/coveo/headless/ -name \"*.backup.*\" -mtime +30 -delete"
        echo "  find scripts/coveo/bueno/v1.0.21/ -name \"*.backup.*\" -mtime +30 -delete"
        echo
    fi
}

# Main execution
main() {
    echo "============================================================="
    echo "  Coveo SDK Download: Headless v3.27.4 + Bueno v1.0.21"
    echo "  Headless Target: /scripts/coveo/headless/"
    echo "  Bueno Target: /scripts/coveo/bueno/v1.0.21/"
    echo "  Feature: Automatic Backup of Existing Files"
    echo "============================================================="
    echo
    
    check_prerequisites
    create_directories
    backup_existing_files
    download_coveo_files
    verify_downloads
    list_backup_files
    
    echo
    print_success "Coveo SDK download completed!"
    echo
    echo "Downloaded files:"
    echo "  Headless files:"
    echo "    - /c/aem-live/da-tutorial-main/scripts/coveo/headless/headless.esm.js (v3.27.4)"
    echo "    - /c/aem-live/da-tutorial-main/scripts/coveo/headless/headless.esm.js.map (source map)"
    echo "  Bueno file:"
    echo "    - /c/aem-live/da-tutorial-main/scripts/coveo/bueno/v1.0.21/bueno.esm.js (v1.0.21)"
    echo
    echo "Import paths for your AEM Edge Delivery project:"
    echo "  import * as coveo from '/scripts/coveo/headless/headless.esm.js';"
    echo "  import * as bueno from '/scripts/coveo/bueno/v1.0.21/bueno.esm.js';"
    echo
    echo "Example usage:"
    echo "  const { buildSearchEngine } = coveo;"
    echo "  const engine = buildSearchEngine({"
    echo "    configuration: {"
    echo "      organizationId: 'YOUR_ORG_ID',"
    echo "      accessToken: 'YOUR_ACCESS_TOKEN',"
    echo "    }"
    echo "  });"
    echo
}

# Run main function
main "$@"