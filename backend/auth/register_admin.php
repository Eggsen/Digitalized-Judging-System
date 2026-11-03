<?php

header("Content-Type: application/json");
http_response_code(403);

echo json_encode([
    "success" => false,
    "message" => "Public admin registration is disabled for security reasons. Admin accounts can only be provisioned by authorized administrators via invitation."
]);
exit;
