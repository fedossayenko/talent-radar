#!/bin/bash

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}📊 TalentRadar Database Monitor${NC}"
echo ""

# Function to check if Docker services are running
check_services() {
    echo -e "${YELLOW}🔍 Checking Docker services...${NC}"
    
    if ! docker-compose -f docker-compose.dev.yml ps | grep -q "Up"; then
        echo -e "${RED}❌ Docker services are not running${NC}"
        echo "Please start services with: ./scripts/docker-dev.sh"
        return 1
    fi
    
    echo -e "${GREEN}✅ Docker services are running${NC}"
    return 0
}

# Function to start Prisma Studio
start_prisma_studio() {
    echo -e "${YELLOW}🎯 Starting Prisma Studio...${NC}"
    
    # Check if Prisma Studio is already running
    if docker-compose -f docker-compose.dev.yml --profile tools ps | grep -q "prisma-studio.*Up"; then
        echo -e "${GREEN}✅ Prisma Studio is already running${NC}"
    else
        echo -e "${YELLOW}🚀 Launching Prisma Studio...${NC}"
        docker-compose -f docker-compose.dev.yml --profile tools up -d prisma-studio
        
        # Wait a moment for startup
        sleep 5
        
        if docker-compose -f docker-compose.dev.yml --profile tools ps | grep -q "prisma-studio.*Up"; then
            echo -e "${GREEN}✅ Prisma Studio started successfully${NC}"
        else
            echo -e "${RED}❌ Failed to start Prisma Studio${NC}"
            return 1
        fi
    fi
    
    echo ""
    echo -e "${BLUE}📊 Database access:${NC}"
    echo "  - Prisma Studio: http://localhost:5555"
    echo "  - Direct SQLite: docker exec -it talent-radar-api sqlite3 /app/apps/api/dev.db"
    echo ""
}

# Function to show database statistics
show_database_stats() {
    echo -e "${YELLOW}📈 Database Statistics${NC}"
    echo ""
    
    # Get basic table counts
    echo -e "${BLUE}📋 Table Counts:${NC}"
    docker exec -it talent-radar-api sqlite3 /app/apps/api/dev.db << 'EOF'
.headers on
.mode column
SELECT 
    'Companies' as table_name, 
    COUNT(*) as count 
FROM companies
UNION ALL
SELECT 
    'Vacancies' as table_name, 
    COUNT(*) as count 
FROM vacancies
UNION ALL
SELECT 
    'AI Processed' as table_name, 
    COUNT(*) as count 
FROM vacancies 
WHERE extractionConfidence > 0;
EOF
    
    echo ""
    
    # Get AI processing statistics
    echo -e "${BLUE}🤖 AI Processing Stats:${NC}"
    docker exec -it talent-radar-api sqlite3 /app/apps/api/dev.db << 'EOF'
.headers on
.mode column
SELECT 
    AVG(extractionConfidence) as avg_confidence,
    AVG(qualityScore) as avg_quality,
    COUNT(*) as total_processed,
    MAX(createdAt) as last_processed
FROM vacancies 
WHERE extractionConfidence > 0;
EOF
    
    echo ""
    
    # Get recent vacancies with AI data
    echo -e "${BLUE}📄 Recent AI-Processed Vacancies:${NC}"
    docker exec -it talent-radar-api sqlite3 /app/apps/api/dev.db << 'EOF'
.headers on
.mode column
.width 30 20 15 15 15
SELECT 
    title,
    company,
    extractionConfidence as confidence,
    qualityScore as quality,
    createdAt
FROM vacancies 
WHERE extractionConfidence > 0
ORDER BY createdAt DESC
LIMIT 10;
EOF
    
    echo ""
}

# Function to show Redis cache statistics
show_redis_stats() {
    echo -e "${YELLOW}🔴 Redis Cache Statistics${NC}"
    echo ""
    
    # Check Redis connection
    if docker exec -it talent-radar-redis redis-cli ping 2>/dev/null | grep -q "PONG"; then
        echo -e "${GREEN}✅ Redis is connected${NC}"
        
        # Get cache statistics
        echo -e "${BLUE}📊 Cache Stats:${NC}"
        docker exec -it talent-radar-redis redis-cli << 'EOF'
INFO memory
INFO keyspace
EOF
        
        echo ""
        echo -e "${BLUE}🔑 Cache Keys:${NC}"
        docker exec -it talent-radar-redis redis-cli KEYS "vacancy_extraction:*" | head -10
        
    else
        echo -e "${RED}❌ Redis is not responding${NC}"
    fi
    
    echo ""
}

# Function to export data
export_data() {
    echo -e "${YELLOW}💾 Exporting Data${NC}"
    echo ""
    
    # Create exports directory
    mkdir -p exports
    
    # Export all vacancies with AI data
    docker exec -it talent-radar-api sqlite3 /app/apps/api/dev.db << 'EOF' > exports/ai_vacancies.csv
.headers on
.mode csv
SELECT 
    id,
    title,
    company,
    location,
    extractionConfidence,
    qualityScore,
    createdAt,
    aiExtractedData
FROM vacancies 
WHERE extractionConfidence > 0
ORDER BY extractionConfidence DESC;
EOF
    
    if [ -f exports/ai_vacancies.csv ]; then
        echo -e "${GREEN}✅ Exported AI vacancies to: exports/ai_vacancies.csv${NC}"
    else
        echo -e "${RED}❌ Failed to export data${NC}"
    fi
    
    echo ""
}

# Function to show available monitoring options
show_monitoring_options() {
    echo -e "${BLUE}🛠 Monitoring Options:${NC}"
    echo "  [1] Start Prisma Studio (Database GUI)"
    echo "  [2] Show Database Statistics"
    echo "  [3] Show Redis Cache Statistics"  
    echo "  [4] Export AI Vacancy Data"
    echo "  [5] Start Redis Commander (Cache GUI)"
    echo "  [6] View Live API Logs"
    echo "  [7] All of the above"
    echo "  [q] Quit"
    echo ""
}

# Function to handle user choice
handle_choice() {
    case $1 in
        1)
            start_prisma_studio
            ;;
        2)
            show_database_stats
            ;;
        3)
            show_redis_stats
            ;;
        4)
            export_data
            ;;
        5)
            echo -e "${YELLOW}🚀 Starting Redis Commander...${NC}"
            docker-compose -f docker-compose.dev.yml --profile tools up -d redis-commander
            echo -e "${GREEN}✅ Redis Commander: http://localhost:8081${NC}"
            ;;
        6)
            echo -e "${YELLOW}📋 Showing live API logs (Ctrl+C to exit)...${NC}"
            docker-compose -f docker-compose.dev.yml logs -f api
            ;;
        7)
            start_prisma_studio
            show_database_stats
            show_redis_stats
            export_data
            echo -e "${YELLOW}🚀 Starting Redis Commander...${NC}"
            docker-compose -f docker-compose.dev.yml --profile tools up -d redis-commander
            echo -e "${GREEN}✅ Redis Commander: http://localhost:8081${NC}"
            ;;
        q)
            echo -e "${GREEN}👋 Goodbye!${NC}"
            exit 0
            ;;
        *)
            echo -e "${RED}❌ Invalid option${NC}"
            ;;
    esac
}

# Main execution
main() {
    # Check if services are running
    if ! check_services; then
        exit 1
    fi
    
    if [ $# -eq 0 ]; then
        # Interactive mode
        while true; do
            echo ""
            show_monitoring_options
            read -p "Choose an option: " choice
            echo ""
            handle_choice "$choice"
            
            if [ "$choice" != "6" ]; then
                echo ""
                read -p "Press Enter to continue..."
            fi
        done
    else
        # Direct command mode
        handle_choice "$1"
    fi
}

# Run main function with all arguments
main "$@"