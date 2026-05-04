import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { MetricsService } from './metrics.service';

@Injectable()
export class HttpMetricsInterceptor implements NestInterceptor {
  constructor(private readonly metricsService: MetricsService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const request = http.getRequest();
    const response = http.getResponse();

    const route = request.route?.path ?? request.path ?? 'unknown';

    if (route === '/metrics') {
      return next.handle();
    }

    const method = request.method;
    const end = this.metricsService.startHttpTimer();

    return next.handle().pipe(
      finalize(() => {
        const status_code = String(response.statusCode);
        const labels = { method, route, status_code };

        this.metricsService.incrementHttpRequest(labels);
        end(labels);
      }),
    );
  }
}
