// src/migrations/00_analysis.js
const fs = require('fs').promises;
const path = require('path');
const xml2js = require('xml2js');
const logger = require('../utils/logger');

/**
 * Gets the source directory based on environment variables and command flags
 * @param {boolean} useSamples - Whether to use sample data directory
 * @returns {string} Absolute path to source directory
 */
function getSourceDirectory(useSamples = false) {
    const baseDir = path.join(__dirname, '../../');
    
    if (useSamples) {
        return path.join(baseDir, 'data/source/samples');
    }
    
    return path.join(baseDir, process.env.SOURCE_DIR || 'data/source');
}

/**
 * Analyzes XML data files and generates a summary report
 * @param {string} sourceDir - Directory containing source XML files
 * @returns {Promise<Object>} Analysis results
 */
async function analyzeData(sourceDir) {
    try {
        // Initialize counters for our analysis
        const analysis = {
            tickets: {
                total: 0,
                withAttachments: 0,
                withCCs: 0,
                byBrand: {},
                customFields: new Set()
            },
            users: {
                total: 0,
                byOrganization: {}
            },
            organizations: {
                total: 0
            }
        };

        // Parse tickets XML
        const ticketsXml = await fs.readFile(
            path.join(sourceDir, 'tickets.xml'),
            'utf-8'
        );
        const ticketData = await xml2js.parseStringPromise(ticketsXml);

        // Analyze tickets
        for (const ticket of ticketData.tickets.ticket || []) {
            analysis.tickets.total++;
            
            // Check for attachments
            if (ticket.attachments && ticket.attachments.length > 0) {
                analysis.tickets.withAttachments++;
            }

            // Check for CC'd users
            if (ticket.cc_users && ticket.cc_users.length > 0) {
                analysis.tickets.withCCs++;
            }

            // Count tickets by brand
            const brandId = ticket.brand_id?.[0] || 'undefined';
            analysis.tickets.byBrand[brandId] = 
                (analysis.tickets.byBrand[brandId] || 0) + 1;

            // Track custom fields
            if (ticket.custom_fields) {
                for (const field of ticket.custom_fields) {
                    if (field.id && field.value) {
                        analysis.tickets.customFields.add(field.id[0]);
                    }
                }
            }
        }

        // Parse and analyze users
        const usersXml = await fs.readFile(
            path.join(sourceDir, 'users.xml'),
            'utf-8'
        );
        const userData = await xml2js.parseStringPromise(usersXml);
        
        for (const user of userData.users.user || []) {
            analysis.users.total++;
            
            const orgId = user.organization_id?.[0] || 'none';
            analysis.users.byOrganization[orgId] = 
                (analysis.users.byOrganization[orgId] || 0) + 1;
        }

        // Parse and count organizations
        const orgsXml = await fs.readFile(
            path.join(sourceDir, 'organizations.xml'),
            'utf-8'
        );
        const orgData = await xml2js.parseStringPromise(orgsXml);
        analysis.organizations.total = (orgData.organizations.organization || []).length;

        // Convert custom fields set to array for easier handling
        analysis.tickets.customFields = Array.from(analysis.tickets.customFields);

        // Calculate estimated migration time (based on rate limits)
        const requestsPerMinute = 75; // From config
        const totalRequests = analysis.tickets.total + 
                            analysis.users.total + 
                            analysis.organizations.total;
        
        analysis.estimatedTimeMinutes = Math.ceil(totalRequests / requestsPerMinute);

        // Save analysis results
        try {
            // First, make sure the mapping directory exists
            const mappingDir = path.join(sourceDir, '../mapping');
            await fs.mkdir(mappingDir, { recursive: true });  
            
            // Now save the file
            await fs.writeFile(
                path.join(mappingDir, 'analysis_results.json'),
                JSON.stringify(analysis, null, 2)
            );
        } catch (error) {
            logger.error('Failed to save analysis results:', error);
            throw error;
        }

        return analysis;

    } catch (error) {
        logger.error('Analysis failed:', error);
        throw error;
    }
}

// Only run if called directly from command line
if (require.main === module) {
    const useSamples = process.argv.includes('--samples');
    const sourceDir = getSourceDirectory(useSamples);
    
    logger.info(`Starting analysis of Zendesk data from ${sourceDir}...`);
    analyzeData(sourceDir)
        .then(results => {
            logger.info('Analysis complete! Summary:');
            logger.info(`Total Tickets: ${results.tickets.total}`);
            logger.info(`Total Users: ${results.users.total}`);
            logger.info(`Total Organizations: ${results.organizations.total}`);
            logger.info(`Estimated migration time: ${results.estimatedTimeMinutes} minutes`);
            logger.info('Full results saved to data/mapping/analysis_results.json');
        })
        .catch(error => {
            logger.error('Analysis failed:', error);
            process.exit(1);
        });
}

module.exports = {
    analyzeData,
    getSourceDirectory
};