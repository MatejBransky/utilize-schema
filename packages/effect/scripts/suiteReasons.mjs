const REFERENCE_PATTERN = /^(ref|anchor|id|recursive|dynamic|vocabulary)/;

export function reasonFor(file) {
	if (file.startsWith('patternProperties')) {
		return 'patternProperties is not generated';
	}
	if (file.startsWith('format-')) {
		return 'format validation disagrees with the Zod helpers';
	}
	if (REFERENCE_PATTERN.test(file)) {
		return 'reference resolution gap';
	}

	return remainingReasonFor(file);
}

function remainingReasonFor(file) {
	if (file.startsWith('unevaluated')) {
		return 'unevaluated keywords are mapped best effort';
	}
	if (file.startsWith('allOf')) {
		return 'allOf is limited to disjoint object subschemas';
	}
	if (file.startsWith('oneOf')) {
		return 'oneOf semantics differ from the Zod generator';
	}

	return 'keyword is not covered by the Effect Schema generator yet';
}
