package com.guamradar.backend;

import java.sql.Connection;
import java.sql.DriverManager;
import java.sql.ResultSet;
import java.sql.Statement;
import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
public class DbPingController {
  @Value("${DB_PING_ENABLED:false}")
  private boolean enabled;

  @Value("${SPRING_DATASOURCE_URL:}")
  private String url;

  @Value("${SPRING_DATASOURCE_USERNAME:}")
  private String username;

  @Value("${SPRING_DATASOURCE_PASSWORD:}")
  private String password;

  @GetMapping("/api/db-ping")
  public ResponseEntity<Map<String, Object>> ping() throws Exception {
    if (!enabled) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false));
    }

    if (url == null || url.isBlank()) {
      return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
        .body(Map.of("ok", false, "error", "SPRING_DATASOURCE_URL is not configured."));
    }

    try (
      Connection connection = DriverManager.getConnection(url, username, password);
      Statement statement = connection.createStatement();
      ResultSet resultSet = statement.executeQuery("select 1")
    ) {
      resultSet.next();
      return ResponseEntity.ok(Map.of("ok", true, "db", resultSet.getInt(1)));
    }
  }
}
