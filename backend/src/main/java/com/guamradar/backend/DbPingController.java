package com.guamradar.backend;

import java.util.Map;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;

@RestController
public class DbPingController {
  private final JdbcTemplate jdbc;

  @Value("${DB_PING_ENABLED:false}")
  private boolean enabled;

  public DbPingController(JdbcTemplate jdbc) {
    this.jdbc = jdbc;
  }

  @GetMapping("/api/db-ping")
  public ResponseEntity<Map<String, Object>> ping() {
    if (!enabled) {
      return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("ok", false));
    }
    Integer one = jdbc.queryForObject("select 1", Integer.class);
    return ResponseEntity.ok(Map.of("ok", true, "db", one));
  }
}

