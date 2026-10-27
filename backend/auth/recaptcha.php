<?php

/**
 * Helper to verify Google reCAPTCHA v2 token with Google siteverify API.
 * 
 * @param string|null $token The recaptcha response token submitted by the client
 * @return array ['success' => bool, 'message' => string]
 */
function verifyRecaptcha(?string $token): array {
    global $settingsCollection;
    if (isset($settingsCollection)) {
        try {
            $settingsDoc = $settingsCollection->findOne(['_id' => 'system_settings']);
            if (isset($settingsDoc['security']['recaptchaEnabled']) && $settingsDoc['security']['recaptchaEnabled'] === false) {
                return [
                    'success' => true,
                    'message' => 'reCAPTCHA verification skipped (disabled by administrator).'
                ];
            }
        } catch (Throwable $e) {
            // Proceed to verify if query fails
        }
    }

    $secretKey = $_ENV['RECAPTCHA_SECRET_KEY'] ?? '';

    if (empty($secretKey)) {
        error_log("reCAPTCHA Warning: RECAPTCHA_SECRET_KEY is not configured in .env");
        return [
            'success' => false,
            'message' => 'reCAPTCHA is not configured on the server.'
        ];
    }

    $token = trim($token ?? '');
    if (empty($token)) {
        return [
            'success' => false,
            'message' => 'Please complete the reCAPTCHA verification to proceed.'
        ];
    }

    $verifyUrl = "https://www.google.com/recaptcha/api/siteverify";
    $postData = [
        'secret'   => $secretKey,
        'response' => $token,
        'remoteip' => $_SERVER['REMOTE_ADDR'] ?? ''
    ];

    if (!extension_loaded('curl')) {
        return [
            'success' => false,
            'message' => 'PHP cURL extension is not enabled. Please enable extension=curl in your php.ini.'
        ];
    }

    $ch = curl_init($verifyUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST           => true,
        CURLOPT_POSTFIELDS     => http_build_query($postData),
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT        => 10,
        CURLOPT_SSL_VERIFYPEER => true
    ]);

    $response = curl_exec($ch);
    $errno = curl_errno($ch);

    // If local environment lacks CA bundle (common on Windows PHP/XAMPP error 60/77)
    if ($response === false && in_array($errno, [60, 77], true)) {
        curl_setopt($ch, CURLOPT_SSL_VERIFYPEER, false);
        curl_setopt($ch, CURLOPT_SSL_VERIFYHOST, 0);
        $response = curl_exec($ch);
    }

    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    $curlError = curl_error($ch);
    unset($ch);

    if ($response === false || $httpCode !== 200) {
        error_log("reCAPTCHA cURL error: " . ($curlError ?: "HTTP $httpCode"));
        return [
            'success' => false,
            'message' => 'Unable to verify reCAPTCHA with Google servers (' . ($curlError ?: "HTTP $httpCode") . '). Please try again.'
        ];
    }

    $result = json_decode($response, true);
    if (!empty($result['success'])) {
        return [
            'success' => true,
            'message' => 'reCAPTCHA verified.'
        ];
    }

    $errorCodes = $result['error-codes'] ?? [];
    error_log("reCAPTCHA failed verification: " . json_encode($errorCodes));

    return [
        'success' => false,
        'message' => 'reCAPTCHA verification failed. Please try checking the box again.'
    ];
}
