<?php

/*
 * ScanController.php
 * Firefly III Custom: the Scan page (receipts and invoices).
 *
 * index() renders the page; extract() passes one uploaded photo or PDF to the scan service
 * (firefly/scan in the GauravVPS repo, reachable as http://scan:8080 inside the compose network) and
 * returns the fields it read. Matching, creating transactions and attaching the file happen in
 * js/custom/scan.js through the v1 API.
 */

declare(strict_types=1);

namespace FireflyIII\Http\Controllers\Custom;

use FireflyIII\Http\Controllers\Controller;
use GuzzleHttp\Client;
use GuzzleHttp\Exception\GuzzleException;
use Illuminate\Contracts\View\View;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

final class ScanController extends Controller
{
    private const array TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

    public function __construct()
    {
        parent::__construct();

        $this->middleware(static function ($request, $next) {
            app('view')->share('title', 'Scan');
            app('view')->share('mainTitleIcon', 'bi-camera');

            return $next($request);
        });
    }

    public function index(): View
    {
        return view('custom.scan');
    }

    public function extract(Request $request): JsonResponse
    {
        $file = $request->file('file');
        if (null === $file || !$file->isValid()) {
            return response()->json(['ok' => false, 'error' => 'No file arrived. Try again.'], 400);
        }
        $type = (string) $file->getMimeType();
        if (!in_array($type, self::TYPES, true)) {
            return response()->json(['ok' => false, 'error' => 'Send a JPEG, PNG or WebP photo, or a PDF.'], 415);
        }
        if ($file->getSize() > 20 * 1024 * 1024) {
            return response()->json(['ok' => false, 'error' => 'The file is larger than 20 MB.'], 413);
        }
        $url = getenv('FINANCE_SCAN_URL') ?: 'http://scan:8080';

        try {
            $response = new Client(['timeout' => 170, 'http_errors' => false])->post($url.'/extract', [
                'headers' => ['Content-Type' => $type],
                'body'    => fopen($file->getRealPath(), 'rb'),
            ]);
        } catch (GuzzleException $e) {
            Log::error(sprintf('Scan service unreachable: %s', $e->getMessage()));

            return response()->json(['ok' => false, 'error' => 'The scan service is not reachable right now.'], 503);
        }
        $body = json_decode((string) $response->getBody(), true);
        if (!is_array($body)) {
            return response()->json(['ok' => false, 'error' => 'The scan service gave an unreadable answer.'], 502);
        }

        return response()->json($body, $response->getStatusCode());
    }
}
