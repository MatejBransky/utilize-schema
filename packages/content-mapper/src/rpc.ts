type Handler = (params: unknown) => unknown | Promise<unknown>;

/**
 * Minimal JSON-RPC 2.0 server over stdio with the LSP-style `Content-Length`
 * framing TypeScript uses for content mappers.
 */
export function serve(handlers: Record<string, Handler>): void {
	let buffer = Buffer.alloc(0);

	// `process.exit()` drops writes that are still queued, which can lose the
	// answer to the last request. Setting the code lets the event loop drain
	// stdout first and exit on its own.
	process.stdin.on('end', () => {
		process.exitCode = 0;
	});
	process.stdin.on('data', (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk]);

		for (;;) {
			const headerEnd = buffer.indexOf('\r\n\r\n');

			if (headerEnd === -1) {
				return;
			}

			const header = buffer.subarray(0, headerEnd).toString('ascii');
			const match = /Content-Length:\s*(\d+)/i.exec(header);

			if (!match) {
				throw new Error(`Bad content mapper header: ${header}`);
			}

			const length = Number(match[1]);
			const bodyStart = headerEnd + 4;

			if (buffer.length < bodyStart + length) {
				return;
			}

			const body = buffer.subarray(bodyStart, bodyStart + length).toString('utf8');

			buffer = buffer.subarray(bodyStart + length);
			void dispatch(JSON.parse(body) as Request);
		}
	});

	async function dispatch(message: Request) {
		const handler = handlers[message.method];
		let response: Response;

		try {
			if (!handler) {
				throw new Error(`Unknown content mapper method ${message.method}`);
			}

			response = {
				jsonrpc: '2.0',
				id: message.id,
				result: (await handler(message.params)) ?? {},
			};
		} catch (error) {
			response = {
				jsonrpc: '2.0',
				id: message.id,
				error: {
					code: -32_603,
					message: error instanceof Error ? (error.stack ?? error.message) : String(error),
				},
			};
		}

		if (message.id === undefined) {
			return;
		}

		const payload = Buffer.from(JSON.stringify(response), 'utf8');

		process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
		process.stdout.write(payload);
	}
}

interface Request {
	id?: number | string;
	method: string;
	params?: unknown;
}

type Response =
	| { jsonrpc: '2.0'; id: number | string | undefined; result: unknown }
	| { jsonrpc: '2.0'; id: number | string | undefined; error: { code: number; message: string } };
