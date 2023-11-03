// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT License.

import * as assert from 'assert';
import {
    JSONRPC_CONTENT_LENGTH_HEADER,
    JSONRPC_CONTENT_TYPE_HEADER,
    JSONRPC_UUID_HEADER,
    ExtractJsonRPCData,
    parseJsonRPCHeadersAndData,
    splitTestNameWithRegex,
    ConcatBuffer,
} from '../../../client/testing/testController/common/utils';

const bufString = (s: string) => {
    // chunk it to make sure processing is handled correctly
    const chunks: Buffer[] = [];
    for (let i = 0; i < s.length; ) {
        const next = i + Math.floor(Math.random() * 5);
        chunks.push(Buffer.from(s.slice(i, next)));
        i = next;
    }
    return new ConcatBuffer(chunks);
};

suite('Test Controller Utils: ConcatBuffer', () => {
    test('indexOf', () => {
        const b = new ConcatBuffer([Buffer.from('abc'), Buffer.from('def')]);
        assert.strictEqual(b.indexOf('a'.charCodeAt(0)), 0);
        assert.strictEqual(b.indexOf('b'.charCodeAt(0)), 1);
        assert.strictEqual(b.indexOf('c'.charCodeAt(0)), 2);
        assert.strictEqual(b.indexOf('d'.charCodeAt(0)), 3);
        assert.strictEqual(b.indexOf('e'.charCodeAt(0)), 4);
        assert.strictEqual(b.indexOf('f'.charCodeAt(0)), 5);
        assert.strictEqual(b.indexOf('g'.charCodeAt(0)), -1);
    });

    test('toString', () => {
        const b = new ConcatBuffer([Buffer.from('abc'), Buffer.from('def')]);
        assert.strictEqual(b.toString(), 'abcdef');
    });

    test('subarray', () => {
        const b = new ConcatBuffer([Buffer.from('abc'), Buffer.from('def')]);
        assert.strictEqual(b.subarray(0, 2).toString(), 'ab');
        assert.strictEqual(b.subarray(4, 6).toString(), 'ef');
        assert.strictEqual(b.subarray(2, 5).toString(), 'cde');
        assert.strictEqual(b.subarray(0, 6).toString(), 'abcdef');
    });
});

suite('Test Controller Utils: JSON RPC', () => {
    test('Empty raw data string', async () => {
        const rawDataString = '';

        const output = parseJsonRPCHeadersAndData(bufString(rawDataString));
        assert.deepStrictEqual(output.headers.size, 0);
        assert.deepStrictEqual(output.remainingRawData.toString(), '');
    });

    test('Valid data empty JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 2\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n{}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(rawDataString));
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData.toString(), '{}');
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), '{}');
    });

    test('Valid data NO JSON', async () => {
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: 0\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n`;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(rawDataString));
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData.toString(), '');
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), '');
    });

    test('Valid data with full JSON', async () => {
        // this is just some random JSON
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(rawDataString));
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        assert.deepStrictEqual(rpcHeaders.remainingRawData.toString(), json);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), json);
    });

    test('Valid data with multiple JSON', async () => {
        const json =
            '{"jsonrpc": "2.0", "method": "initialize", "params": {"processId": 1234, "rootPath": "/home/user/project", "rootUri": "file:///home/user/project", "capabilities": {}}, "id": 0}';
        const rawDataString = `${JSONRPC_CONTENT_LENGTH_HEADER}: ${json.length}\n${JSONRPC_CONTENT_TYPE_HEADER}: application/json\n${JSONRPC_UUID_HEADER}: 1234\n\n${json}`;
        const rawDataString2 = rawDataString + rawDataString;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(rawDataString2));
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), json);
        assert.deepStrictEqual(rpcContent.remainingRawData.toString(), rawDataString);
    });

    test('Valid constant', async () => {
        const data = `{"cwd": "/Users/eleanorboyd/testingFiles/inc_dec_example", "status": "success", "result": {"test_dup_class.test_a.TestSomething.test_a": {"test": "test_dup_class.test_a.TestSomething.test_a", "outcome": "success", "message": "None", "traceback": null, "subtest": null}}}`;
        const secondPayload = `Content-Length: 270
Content-Type: application/json
Request-uuid: 496c86b1-608f-4886-9436-ec00538e144c

${data}`;
        const payload = `Content-Length: 270
Content-Type: application/json
Request-uuid: 496c86b1-608f-4886-9436-ec00538e144c

${data}${secondPayload}`;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(payload));
        assert.deepStrictEqual(rpcHeaders.headers.size, 3);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), data);
        assert.deepStrictEqual(rpcContent.remainingRawData.toString(), secondPayload);
    });
    test('Valid content length as only header with carriage return', async () => {
        const payload = `Content-Length: 7
        `;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(payload));
        assert.deepStrictEqual(rpcHeaders.headers.size, 1);
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), '');
        assert.deepStrictEqual(rpcContent.remainingRawData.toString(), '');
    });
    test('Valid content length header with no value', async () => {
        const payload = `Content-Length:`;

        const rpcHeaders = parseJsonRPCHeadersAndData(bufString(payload));
        const rpcContent = ExtractJsonRPCData(rpcHeaders.headers.get('Content-Length'), rpcHeaders.remainingRawData);
        assert.deepStrictEqual(rpcContent.extractedJSON.toString(), '');
        assert.deepStrictEqual(rpcContent.remainingRawData.toString(), '');
    });

    suite('Test Controller Utils: Other', () => {
        interface TestCase {
            name: string;
            input: string;
            expectedParent: string;
            expectedSubtest: string;
        }

        const testCases: Array<TestCase> = [
            {
                name: 'Single parameter, named',
                input: 'test_package.ClassName.test_method (param=value)',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '(param=value)',
            },
            {
                name: 'Single parameter, unnamed',
                input: 'test_package.ClassName.test_method [value]',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '[value]',
            },
            {
                name: 'Multiple parameters, named',
                input: 'test_package.ClassName.test_method (param1=value1, param2=value2)',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '(param1=value1, param2=value2)',
            },
            {
                name: 'Multiple parameters, unnamed',
                input: 'test_package.ClassName.test_method [value1, value2]',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '[value1, value2]',
            },
            {
                name: 'Names with special characters',
                input: 'test_package.ClassName.test_method (param1=value/1, param2=value+2)',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '(param1=value/1, param2=value+2)',
            },
            {
                name: 'Names with spaces',
                input: 'test_package.ClassName.test_method ["a b c d"]',
                expectedParent: 'test_package.ClassName.test_method',
                expectedSubtest: '["a b c d"]',
            },
        ];

        testCases.forEach((testCase) => {
            test(`splitTestNameWithRegex: ${testCase.name}`, () => {
                const splitResult = splitTestNameWithRegex(testCase.input);
                assert.deepStrictEqual(splitResult, [testCase.expectedParent, testCase.expectedSubtest]);
            });
        });
    });
});
