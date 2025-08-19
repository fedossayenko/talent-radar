#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

API_URL="http://localhost:3000"

echo -e "${BLUE}🔄 TalentRadar AI Scraping Trigger${NC}"
echo ""

# Function to check if API is running
check_api_health() {
    echo -e "${YELLOW}🏥 Checking API health...${NC}"
    if curl -s "${API_URL}/api/v1/health" >/dev/null 2>&1; then
        echo -e "${GREEN}✅ API is healthy${NC}"
        return 0
    else
        echo -e "${RED}❌ API is not responding${NC}"
        echo "Please make sure the API is running with: ./scripts/docker-dev.sh"
        return 1
    fi
}

# Function to trigger manual scraping
trigger_scraping() {
    echo -e "${YELLOW}🚀 Triggering manual AI scraping...${NC}"
    
    response=$(curl -s -X POST \
        -H "Content-Type: application/json" \
        "${API_URL}/api/v1/scraper/dev-bg/manual" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$response" | grep -q "success"; then
        echo -e "${GREEN}✅ Scraping job queued successfully!${NC}"
        echo ""
        echo -e "${BLUE}📊 Response:${NC}"
        echo "$response" | python3 -m json.tool 2>/dev/null || echo "$response"
        return 0
    else
        echo -e "${RED}❌ Failed to trigger scraping${NC}"
        echo -e "${BLUE}Response:${NC} $response"
        return 1
    fi
}

# Function to get scraping stats
get_scraping_stats() {
    echo -e "${YELLOW}📈 Getting scraping statistics...${NC}"
    
    stats=$(curl -s "${API_URL}/api/v1/scraper/stats" 2>/dev/null)
    
    if [ $? -eq 0 ] && echo "$stats" | grep -q "success"; then
        echo -e "${GREEN}✅ Stats retrieved successfully!${NC}"
        echo ""
        echo -e "${BLUE}📊 Scraping Statistics:${NC}"
        echo "$stats" | python3 -m json.tool 2>/dev/null || echo "$stats"
    else
        echo -e "${YELLOW}⚠️ Could not retrieve stats${NC}"
        echo -e "${BLUE}Response:${NC} $stats"
    fi
}

# Function to monitor job processing
monitor_processing() {
    echo ""
    echo -e "${BLUE}👀 Monitoring tips:${NC}"
    echo "  - View real-time logs: docker-compose -f docker-compose.dev.yml logs -f api"
    echo "  - Filter AI logs: docker-compose -f docker-compose.dev.yml logs -f api | grep -E 'AI|GPT|extraction'"
    echo "  - Monitor database: ./scripts/monitor-database.sh"
    echo "  - Redis queue: docker-compose -f docker-compose.dev.yml --profile tools up redis-commander"
    echo ""
    echo -e "${YELLOW}📊 Expected workflow:${NC}"
    echo "  1. Scraping job queued"
    echo "  2. Dev.bg vacancies scraped (5 vacancies max for testing)"
    echo "  3. AI extraction with GPT-5 Nano"
    echo "  4. Results saved to SQLite database"
    echo "  5. Cache stored in Redis"
}

# Main execution
main() {
    # Check if API is running
    if ! check_api_health; then
        exit 1
    fi
    
    echo ""
    
    # Trigger scraping
    if trigger_scraping; then
        echo ""
        
        # Get current stats
        get_scraping_stats
        
        # Show monitoring info
        monitor_processing
        
        echo ""
        echo -e "${GREEN}🎉 Scraping initiated successfully!${NC}"
        echo -e "${BLUE}Check the database in a few minutes for AI-extracted vacancy data.${NC}"
        
    else
        echo ""
        echo -e "${RED}❌ Failed to initiate scraping${NC}"
        echo -e "${YELLOW}💡 Troubleshooting:${NC}"
        echo "  - Check if Docker services are running: docker-compose -f docker-compose.dev.yml ps"
        echo "  - Check API logs: docker-compose -f docker-compose.dev.yml logs api"
        echo "  - Restart services: docker-compose -f docker-compose.dev.yml restart"
        exit 1
    fi
}

# Run main function
main