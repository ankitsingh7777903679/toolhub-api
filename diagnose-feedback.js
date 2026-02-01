const http = require('http');

console.log('--- Starting Feedback System Diagnosis ---');

// Helper for requests
function makeRequest(method, path, data = null) {
    return new Promise((resolve, reject) => {
        const options = {
            hostname: 'localhost',
            port: 3000,
            path: path,
            method: method,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        if (data) {
            options.headers['Content-Length'] = Buffer.byteLength(data);
        }

        const req = http.request(options, (res) => {
            let body = '';
            res.setEncoding('utf8');
            res.on('data', (chunk) => body += chunk);
            res.on('end', () => resolve({ statusCode: res.statusCode, body }));
        });

        req.on('error', (e) => reject(e));

        if (data) req.write(data);
        req.end();
    });
}

async function diagnose() {
    try {
        // 1. Check Health
        console.log('\n1. Checking API Health...');
        const health = await makeRequest('GET', '/api/health');
        console.log('Health Status:', health.statusCode);

        // 2. Try to Get Feedbacks
        console.log('\n2. Fetching Feedbacks...');
        const list = await makeRequest('GET', '/api/feedback');
        console.log('List Status:', list.statusCode);
        console.log('List Body:', list.body.substring(0, 200) + '...');

        // 3. Try to Submit Feedback
        console.log('\n3. Submitting Test Feedback...');
        const postData = JSON.stringify({ content: 'Diagnosis Test ' + Date.now() });
        const submit = await makeRequest('POST', '/api/feedback', postData);
        console.log('Submit Status:', submit.statusCode);
        console.log('Submit Body:', submit.body);

        // 4. List again
        if (submit.statusCode === 201) {
            console.log('\n4. Fetching Feedbacks again...');
            const list2 = await makeRequest('GET', '/api/feedback');
            console.log('List Status:', list2.statusCode);
            console.log('Count:', JSON.parse(list2.body).length);
        }

    } catch (err) {
        console.error('DIAGNOSIS FAILED:', err.message);
    }
}

diagnose();
