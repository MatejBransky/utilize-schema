// fallow-ignore-file coverage-gaps -- the JSON-RPC server runs in the spawned mapper process; the integration tests exercise it end to end

export type Handler = (params: unknown) => unknown | Promise<unknown>;

/** JSON-RPC 2.0 error codes. */
const PARSE_ERROR = -32_700;
const INTERNAL_ERROR = -32_603;

/**
 * Minimal JSON-RPC 2.0 server over stdio with the LSP-style `Content-Length`
 * framing TypeScript uses for content mappers.
 *
 * One mapper process serves every project of a TypeScript server, so a bad
 * frame must never throw out of the `data` listener: that would be an
 * uncaught exception that kills the process. Bad frames are logged to stderr
 * and answered (or dropped) instead.
 */
export function serve(handlers: Record<string, Handler>): void {
	let buffer: Buffer = Buffer.alloc(0);

	// `process.exit()` drops writes that are still queued, which can lose the
	// answer to the last request. Setting the code lets the event loop drain
	// stdout first and exit on its own.
	process.stdin.on('end', () => {
		process.exitCode = 0;
	});
	process.stdin.on('data', (chunk: Buffer) => {
		buffer = Buffer.concat([buffer, chunk]);

		for (let frame = readFrame(buffer); frame; frame = readFrame(buffer)) {
			buffer = frame.rest;

			if (frame.body !== undefined) {
				receive(frame.body);
			}
		}
	});

	function receive(body: string) {
		let message: Request;

		try {
			message = JSON.parse(body) as Request;
		} catch (error) {
			process.stderr.write(`utilize-schema: malformed content mapper message: ${String(error)}\n`);
			send({
				jsonrpc: '2.0',
				id: null,
				error: { code: PARSE_ERROR, message: 'Parse error' },
			});
			return;
		}

		void dispatch(message);
	}

	async function dispatch(message: Request) {
		const handler = handlers[message.method];
		let response: Response;

		try {
			if (!handler) {
				throw new Error(`Unknown content mapper method ${message.method}`);
			}

			response = {
				jsonrpc: '2.0',
				id: message.id ?? null,
				result: (await handler(message.params)) ?? {},
			};
		} catch (error) {
			response = internalError(message.id ?? null, error);
		}

		// A notification has no id and gets no response.
		if (message.id !== undefined) {
			send(response);
		}
	}
}

/**
 * The message ends up in editor diagnostics, so it stays short; the stack
 * goes to stderr, where the TypeScript server logs it.
 */
function internalError(id: number | string | null, error: unknown): Response {
	if (error instanceof Error) {
		process.stderr.write(`${error.stack ?? error.message}\n`);
	}

	return {
		jsonrpc: '2.0',
		id,
		error: {
			code: INTERNAL_ERROR,
			message: error instanceof Error ? error.message : String(error),
		},
	};
}

interface Frame {
	/** The message body, or `undefined` for a frame that was dropped. */
	body?: string;
	rest: Buffer;
}

/**
 * Reads one `Content-Length` frame from the front of `buffer`. Returns
 * `undefined` while the frame is still incomplete. A header without a
 * `Content-Length` cannot be skipped reliably, so the whole buffer is dropped.
 */
function readFrame(buffer: Buffer): Frame | undefined {
	const headerEnd = buffer.indexOf('\r\n\r\n');

	if (headerEnd === -1) {
		return undefined;
	}

	const header = buffer.subarray(0, headerEnd).toString('ascii');
	const match = /Content-Length:\s*(\d+)/i.exec(header);

	if (!match) {
		process.stderr.write(`utilize-schema: dropping bad content mapper header: ${header}\n`);
		return { rest: Buffer.alloc(0) };
	}

	const bodyStart = headerEnd + 4;
	const bodyEnd = bodyStart + Number(match[1]);

	if (buffer.length < bodyEnd) {
		return undefined;
	}

	return {
		body: buffer.subarray(bodyStart, bodyEnd).toString('utf8'),
		rest: buffer.subarray(bodyEnd),
	};
}

function send(response: Response): void {
	const payload = Buffer.from(JSON.stringify(response), 'utf8');

	process.stdout.write(`Content-Length: ${payload.length}\r\n\r\n`);
	process.stdout.write(payload);
}

interface Request {
	id?: number | string;
	method: string;
	params?: unknown;
}

type Response =
	| { jsonrpc: '2.0'; id: number | string | null; result: unknown }
	| { jsonrpc: '2.0'; id: number | string | null; error: { code: number; message: string } };
